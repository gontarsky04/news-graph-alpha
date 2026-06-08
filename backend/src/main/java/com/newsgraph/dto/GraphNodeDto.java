package com.newsgraph.dto;

public record GraphNodeDto(
		String id,
		String label,
		String name,
		String type,
		int relevancy
) {
}
