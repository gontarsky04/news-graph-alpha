package com.newsgraph.controller;

import com.newsgraph.dto.GraphResponse;
import com.newsgraph.service.GraphQueryService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/graph")
public class GraphController {

	private final GraphQueryService graphQueryService;

	public GraphController(GraphQueryService graphQueryService) {
		this.graphQueryService = graphQueryService;
	}

	@GetMapping
	public GraphResponse getGraph() {
		return graphQueryService.getFullGraph();
	}
}
