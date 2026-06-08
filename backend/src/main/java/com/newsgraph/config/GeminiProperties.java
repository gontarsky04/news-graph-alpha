package com.newsgraph.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "newsgraph.gemini")
public class GeminiProperties {

	private String apiKey = "";
	private String model = "gemini-2.0-flash";
	private String baseUrl = "https://generativelanguage.googleapis.com/v1beta";

	public String getApiKey() {
		return apiKey;
	}

	public void setApiKey(String apiKey) {
		this.apiKey = apiKey;
	}

	public String getModel() {
		return model;
	}

	public void setModel(String model) {
		this.model = model;
	}

	public String getBaseUrl() {
		return baseUrl;
	}

	public void setBaseUrl(String baseUrl) {
		this.baseUrl = baseUrl;
	}

	public boolean isConfigured() {
		return apiKey != null && !apiKey.isBlank();
	}
}
