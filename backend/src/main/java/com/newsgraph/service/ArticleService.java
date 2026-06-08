package com.newsgraph.service;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import com.newsgraph.ai.GeminiClient;
import com.newsgraph.dto.ArticleResponse;
import com.newsgraph.dto.ArticleUploadRequest;
import com.newsgraph.dto.ExtractionResult;
import com.newsgraph.exception.ExtractionException;
import com.newsgraph.model.ProcessingStatus;
import com.newsgraph.repository.GraphRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class ArticleService {

	private final GraphRepository graphRepository;
	private final GeminiClient geminiClient;
	private final GraphPersistenceService graphPersistenceService;
	private final ObjectMapper objectMapper;

	public ArticleService(
			GraphRepository graphRepository,
			GeminiClient geminiClient,
			GraphPersistenceService graphPersistenceService,
			ObjectMapper objectMapper
	) {
		this.graphRepository = graphRepository;
		this.geminiClient = geminiClient;
		this.graphPersistenceService = graphPersistenceService;
		this.objectMapper = objectMapper;
	}

	public ArticleResponse uploadAndProcess(ArticleUploadRequest request) {
		String articleId = graphRepository.nextArticleId();
		graphRepository.saveArticle(articleId, request, ProcessingStatus.PROCESSING);
		return runExtraction(articleId, request);
	}

	public ArticleResponse retryArticle(String id) {
		ArticleResponse article = graphRepository.findArticleById(id);
		if (article.status() != ProcessingStatus.FAILED) {
			throw new IllegalStateException("Only failed articles can be retried");
		}
		return runExtraction(id, toUploadRequest(article));
	}

	public List<ArticleResponse> listArticles() {
		return graphRepository.findAllArticles();
	}

	public ArticleResponse getArticle(String id) {
		return graphRepository.findArticleById(id);
	}

	public void deleteArticle(String id) {
		graphRepository.deleteArticle(id);
	}

	private ArticleResponse runExtraction(String articleId, ArticleUploadRequest request) {
		graphRepository.updateArticleStatus(articleId, ProcessingStatus.PROCESSING, null, 0, 0);

		try {
			String existingNodes = graphRepository.loadExistingNodesJson();
			String articlePayload = buildArticlePayload(articleId, request);
			ExtractionResult extraction = geminiClient.extract(existingNodes, articlePayload);
			GraphPersistenceService.PersistenceSummary summary = graphPersistenceService.persist(extraction);

			graphRepository.updateArticleStatus(
					articleId,
					ProcessingStatus.DONE,
					null,
					summary.nodesCreated(),
					summary.relationshipsCreated()
			);
		}
		catch (ExtractionException ex) {
			graphRepository.updateArticleStatus(articleId, ProcessingStatus.FAILED, ex.getMessage(), 0, 0);
			throw ex;
		}

		return graphRepository.findArticleById(articleId);
	}

	private ArticleUploadRequest toUploadRequest(ArticleResponse article) {
		return new ArticleUploadRequest(
				article.title(),
				article.source(),
				article.author(),
				article.date(),
				article.body(),
				article.tags()
		);
	}

	private String buildArticlePayload(String articleId, ArticleUploadRequest request) {
		try {
			return objectMapper.writeValueAsString(Map.of(
					"id", articleId,
					"title", request.title(),
					"source", request.source() != null ? request.source() : "",
					"author", request.author() != null ? request.author() : "",
					"date", request.date() != null ? request.date() : "",
					"body", request.body()
			));
		}
		catch (JacksonException ex) {
			throw new IllegalStateException("Failed to build article payload", ex);
		}
	}
}
