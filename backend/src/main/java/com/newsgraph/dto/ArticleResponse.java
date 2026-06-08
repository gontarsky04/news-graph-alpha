package com.newsgraph.dto;

import com.newsgraph.model.ProcessingStatus;

import java.time.Instant;
import java.util.List;

public record ArticleResponse(
		String id,
		String title,
		String source,
		String author,
		String date,
		String body,
		List<String> tags,
		ProcessingStatus status,
		String errorMessage,
		Instant createdAt,
		Instant processedAt,
		int nodesCreated,
		int relationshipsCreated
) {
}
