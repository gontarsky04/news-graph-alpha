package com.newsgraph.service;

import com.newsgraph.dto.GraphNodeDto;
import com.newsgraph.dto.GraphRelationshipDto;
import com.newsgraph.dto.GraphResponse;
import com.newsgraph.repository.GraphRepository;
import org.springframework.stereotype.Service;

@Service
public class GraphQueryService {

	private final GraphRepository graphRepository;

	public GraphQueryService(GraphRepository graphRepository) {
		this.graphRepository = graphRepository;
	}

	public GraphResponse getFullGraph() {
		return new GraphResponse(
				graphRepository.loadGraphNodes(),
				graphRepository.loadGraphRelationships()
		);
	}
}
