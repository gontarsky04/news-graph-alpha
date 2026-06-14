package com.newsgraph.service;

import com.newsgraph.ai.ExtractorClient;
import com.newsgraph.dto.ArticleResponse;
import com.newsgraph.dto.ArticleUploadRequest;
import com.newsgraph.exception.ExtractionException;
import com.newsgraph.grpc.ProcessArticleResponse;
import com.newsgraph.model.ProcessingStatus;
import com.newsgraph.repository.GraphRepository;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

@Service
public class ArticleService {

	private final GraphRepository graphRepository;
	private final ExtractorClient extractorClient;

	public ArticleService(GraphRepository graphRepository, ExtractorClient extractorClient) {
		this.graphRepository = graphRepository;
		this.extractorClient = extractorClient;
	}

	public ArticleResponse uploadAndProcess(ArticleUploadRequest request) {
		// Content-hash dedup (the strategy the PoC pipeline used internally,
		// now owned by Spring since it owns the Article node).
		String hash = sha256(request.body());
		String existingId = graphRepository.findArticleIdByHash(hash);
		if (existingId != null) {
			return graphRepository.findArticleById(existingId);
		}

		String articleId = graphRepository.nextArticleId();
		graphRepository.saveArticle(articleId, request, hash, ProcessingStatus.PROCESSING);
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
			ProcessArticleResponse result = extractorClient.process(articleId, request);
			int nodesCreated = result.getEntitiesCreated();
			graphRepository.updateArticleStatus(
					articleId,
					ProcessingStatus.DONE,
					null,
					nodesCreated,
					result.getRelationshipsWritten()
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

	private static String sha256(String text) {
		try {
			MessageDigest digest = MessageDigest.getInstance("SHA-256");
			byte[] hash = digest.digest((text != null ? text : "").getBytes(StandardCharsets.UTF_8));
			return HexFormat.of().formatHex(hash);
		}
		catch (NoSuchAlgorithmException ex) {
			throw new IllegalStateException("SHA-256 not available", ex);
		}
	}
}
