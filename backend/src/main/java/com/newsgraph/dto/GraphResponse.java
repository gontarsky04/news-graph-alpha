package com.newsgraph.dto;

import java.util.List;

public record GraphResponse(
		List<GraphNodeDto> nodes,
		List<GraphRelationshipDto> relationships
) {
}
