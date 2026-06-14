package com.newsgraph.ai;

import io.grpc.StatusRuntimeException;
import io.grpc.health.v1.HealthCheckRequest;
import io.grpc.health.v1.HealthCheckResponse;
import io.grpc.health.v1.HealthGrpc;
import com.newsgraph.dto.ArticleUploadRequest;
import com.newsgraph.exception.ExtractionException;
import com.newsgraph.grpc.ExtractorGrpc;
import com.newsgraph.grpc.ProcessArticleRequest;
import com.newsgraph.grpc.ProcessArticleResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

/**
 * gRPC client for the Python extractor service. Replaces the old Gemini call:
 * the extractor owns LLM extraction + entity linking + writing entities,
 * relationships and MENTIONS edges to Neo4j for an already-created Article node.
 */
@Service
public class ExtractorClient {

	private final ExtractorGrpc.ExtractorBlockingStub stub;
	private final HealthGrpc.HealthBlockingStub healthStub;
	private final long deadlineSeconds;

	public ExtractorClient(
			ExtractorGrpc.ExtractorBlockingStub stub,
			HealthGrpc.HealthBlockingStub healthStub,
			@Value("${newsgraph.extractor.deadline-seconds:120}") long deadlineSeconds
	) {
		this.stub = stub;
		this.healthStub = healthStub;
		this.deadlineSeconds = deadlineSeconds;
	}

	public ProcessArticleResponse process(String articleId, ArticleUploadRequest request) {
		ProcessArticleRequest grpcRequest = ProcessArticleRequest.newBuilder()
				.setArticleId(articleId)
				.setTitle(nullSafe(request.title()))
				.setText(nullSafe(request.body()))
				.setUrl(nullSafe(request.source()))
				.setAuthor(nullSafe(request.author()))
				.setDatePublished(nullSafe(request.date()))
				.build();

		try {
			return stub.withDeadlineAfter(deadlineSeconds, TimeUnit.SECONDS)
					.processArticle(grpcRequest);
		}
		catch (StatusRuntimeException ex) {
			String description = ex.getStatus().getDescription();
			throw new ExtractionException(
					description != null ? description : "Extractor gRPC error: " + ex.getStatus().getCode(),
					ex
			);
		}
	}

	/** Used by the health endpoint to confirm the extractor link is up. */
	public boolean isHealthy() {
		try {
			HealthCheckResponse response = healthStub
					.withDeadlineAfter(3, TimeUnit.SECONDS)
					.check(HealthCheckRequest.newBuilder().setService("newsgraph.v1.Extractor").build());
			return response.getStatus() == HealthCheckResponse.ServingStatus.SERVING;
		}
		catch (StatusRuntimeException ex) {
			return false;
		}
	}

	private static String nullSafe(String value) {
		return value != null ? value : "";
	}
}
