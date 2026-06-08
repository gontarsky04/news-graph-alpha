package com.newsgraph.ai;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import com.newsgraph.config.GeminiProperties;
import com.newsgraph.dto.ExtractionResult;
import com.newsgraph.exception.ExtractionException;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;

@Service
public class GeminiClient {

	private final RestClient restClient;
	private final GeminiProperties properties;
	private final ObjectMapper objectMapper;
	private final String systemPrompt;

	public GeminiClient(
			RestClient restClient,
			GeminiProperties properties,
			ObjectMapper objectMapper,
			String extractionSystemPrompt
	) {
		this.restClient = restClient;
		this.properties = properties;
		this.objectMapper = objectMapper;
		this.systemPrompt = extractionSystemPrompt;
	}

	public ExtractionResult extract(String existingNodesJson, String articlePayload) {
		if (!properties.isConfigured()) {
			throw new ExtractionException("Gemini API key is not configured. Set GEMINI_API_KEY in application-local.yml");
		}

		String userMessage = """
				EXISTING_NODES:
				%s

				ARTICLE:
				%s
				""".formatted(existingNodesJson, articlePayload);

		Map<String, Object> requestBody = Map.of(
				"systemInstruction", Map.of(
						"parts", List.of(Map.of("text", systemPrompt))
				),
				"contents", List.of(
						Map.of("parts", List.of(Map.of("text", userMessage)))
				),
				"generationConfig", Map.of(
						"responseMimeType", "application/json",
						"temperature", 0.1
				)
		);

		String url = "%s/models/%s:generateContent?key=%s".formatted(
				properties.getBaseUrl(),
				properties.getModel(),
				properties.getApiKey()
		);

		try {
			String responseBody = restClient.post()
					.uri(url)
					.header("Content-Type", "application/json")
					.body(requestBody)
					.retrieve()
					.onStatus(status -> status.is4xxClientError() || status.is5xxServerError(), (request, response) -> {
						String errorBody = new String(response.getBody().readAllBytes());
						String message = extractGeminiErrorMessage(errorBody);
						throw new ExtractionException(message != null ? message : "Gemini HTTP " + response.getStatusCode());
					})
					.body(String.class);

			String jsonText = extractJsonText(responseBody);
			return objectMapper.readValue(jsonText, ExtractionResult.class);
		}
		catch (ExtractionException ex) {
			throw ex;
		}
		catch (Exception ex) {
			throw new ExtractionException("Gemini extraction failed: " + ex.getMessage(), ex);
		}
	}

	private String extractJsonText(String responseBody) throws Exception {
		JsonNode root = objectMapper.readTree(responseBody);
		JsonNode candidates = root.path("candidates");
		if (!candidates.isArray() || candidates.isEmpty()) {
			throw new ExtractionException("Gemini returned no candidates: " + responseBody);
		}

		String text = candidates.get(0).path("content").path("parts").get(0).path("text").asText();
		if (text == null || text.isBlank()) {
			throw new ExtractionException("Gemini returned empty content");
		}

		return stripMarkdownFence(text.trim());
	}

	private String extractGeminiErrorMessage(String errorBody) {
		try {
			JsonNode error = objectMapper.readTree(errorBody).path("error");
			if (!error.isMissingNode()) {
				return error.path("message").asString(null);
			}
		}
		catch (Exception ignored) {
			// fall through
		}
		return null;
	}

	private String stripMarkdownFence(String text) {
		if (text.startsWith("```")) {
			int firstNewline = text.indexOf('\n');
			int lastFence = text.lastIndexOf("```");
			if (firstNewline >= 0 && lastFence > firstNewline) {
				return text.substring(firstNewline + 1, lastFence).trim();
			}
		}
		return text;
	}
}
