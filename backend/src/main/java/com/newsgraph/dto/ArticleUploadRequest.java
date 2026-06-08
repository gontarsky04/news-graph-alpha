package com.newsgraph.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record ArticleUploadRequest(
		@NotBlank String title,
		String source,
		String author,
		String date,
		@NotBlank String body,
		List<String> tags
) {
}
