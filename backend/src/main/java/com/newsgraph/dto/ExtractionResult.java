package com.newsgraph.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public record ExtractionResult(
		@JsonProperty("article_id") String articleId,
		@JsonProperty("new_nodes") NewNodes newNodes,
		List<RelationshipDto> relationships
) {
	@JsonIgnoreProperties(ignoreUnknown = true)
	public record NewNodes(
			List<Map<String, Object>> articles,
			List<Map<String, Object>> persons,
			List<Map<String, Object>> organizations,
			List<Map<String, Object>> locations,
			List<Map<String, Object>> events,
			List<Map<String, Object>> topics
	) {
	}

	@JsonIgnoreProperties(ignoreUnknown = true)
	public record RelationshipDto(
			String from,
			String to,
			String type,
			String context
	) {
	}
}
