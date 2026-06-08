package com.newsgraph.dto;

public record GraphRelationshipDto(
		String from,
		String to,
		String type
) {
}
