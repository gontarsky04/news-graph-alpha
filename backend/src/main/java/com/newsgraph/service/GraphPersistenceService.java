package com.newsgraph.service;

import com.newsgraph.dto.ExtractionResult;
import com.newsgraph.repository.GraphRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class GraphPersistenceService {

	private static final Set<String> ALLOWED_RELATIONSHIP_TYPES = Set.of(
			"MENTIONS", "PUBLISHED_BY", "CITES", "AUTHORED",
			"LEADS", "MEMBER_OF", "PARTICIPATED_IN", "ORGANIZED",
			"MET_WITH", "CRITICIZED", "SUPPORTED", "APPOINTED", "MENTIONED_IN", "ADDRESSED",
			"CONTROLS", "HAS_ACCESS_TO", "TARGETS",
			"TOOK_PLACE_IN", "RELATED_TO", "CAUSES", "PRECEDED_BY"
	);

	private final GraphRepository graphRepository;

	public GraphPersistenceService(GraphRepository graphRepository) {
		this.graphRepository = graphRepository;
	}

	public PersistenceSummary persist(ExtractionResult result) {
		int nodesCreated = 0;
		int relationshipsCreated = 0;

		if (result.newNodes() != null) {
			nodesCreated += persistNodes("Article", safeList(result.newNodes().articles()));
			nodesCreated += persistNodes("Person", safeList(result.newNodes().persons()));
			nodesCreated += persistNodes("Organization", safeList(result.newNodes().organizations()));
			nodesCreated += persistNodes("Location", safeList(result.newNodes().locations()));
			nodesCreated += persistNodes("Event", safeList(result.newNodes().events()));
			nodesCreated += persistNodes("Topic", safeList(result.newNodes().topics()));
		}

		if (result.relationships() != null) {
			for (ExtractionResult.RelationshipDto relationship : result.relationships()) {
				if (relationship.from() == null || relationship.to() == null || relationship.type() == null) {
					continue;
				}
				if (!ALLOWED_RELATIONSHIP_TYPES.contains(relationship.type())) {
					continue;
				}
				relationshipsCreated += graphRepository.mergeRelationship(
						relationship.from(),
						relationship.to(),
						relationship.type(),
						relationship.context()
				);
			}
		}

		return new PersistenceSummary(nodesCreated, relationshipsCreated);
	}

	private int persistNodes(String defaultLabel, List<Map<String, Object>> nodes) {
		int created = 0;
		for (Map<String, Object> node : nodes) {
			String label = node.getOrDefault("label", defaultLabel).toString();
			created += graphRepository.mergeNode(label, node);
		}
		return created;
	}

	private List<Map<String, Object>> safeList(List<Map<String, Object>> nodes) {
		return nodes != null ? nodes : List.of();
	}

	public record PersistenceSummary(int nodesCreated, int relationshipsCreated) {
	}
}
