package com.newsgraph.controller;

import com.newsgraph.ai.ExtractorClient;
import org.neo4j.driver.Session;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.function.Supplier;

@RestController
@RequestMapping("/api/health")
public class HealthController {

	private final Supplier<Session> sessionSupplier;
	private final ExtractorClient extractorClient;

	public HealthController(Supplier<Session> sessionSupplier, ExtractorClient extractorClient) {
		this.sessionSupplier = sessionSupplier;
		this.extractorClient = extractorClient;
	}

	@GetMapping("/live")
	public Map<String, String> live() {
		return Map.of("status", "ok");
	}

	@GetMapping
	public Map<String, Object> health() {
		boolean extractorUp = extractorClient.isHealthy();
		try (Session session = sessionSupplier.get()) {
			long nodeCount = session.run("MATCH (n) RETURN count(n) AS count")
					.single()
					.get("count")
					.asLong();

			return Map.of(
					"status", extractorUp ? "ok" : "degraded",
					"neo4j", "connected",
					"nodeCount", nodeCount,
					"extractor", extractorUp ? "connected" : "unreachable"
			);
		}
	}
}
