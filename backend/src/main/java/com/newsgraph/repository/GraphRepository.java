package com.newsgraph.repository;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;
import com.newsgraph.dto.ArticleResponse;
import com.newsgraph.dto.ArticleUploadRequest;
import com.newsgraph.dto.GraphNodeDto;
import com.newsgraph.dto.GraphRelationshipDto;
import com.newsgraph.exception.NotFoundException;
import com.newsgraph.model.ProcessingStatus;
import org.neo4j.driver.Session;
import org.neo4j.driver.Value;
import org.neo4j.driver.Values;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Repository
public class GraphRepository {

	private static final Pattern ARTICLE_ID_PATTERN = Pattern.compile("ART_(\\d+)");

	private final Supplier<Session> sessionSupplier;
	private final ObjectMapper objectMapper;

	public GraphRepository(Supplier<Session> sessionSupplier, ObjectMapper objectMapper) {
		this.sessionSupplier = sessionSupplier;
		this.objectMapper = objectMapper;
	}

	public String nextArticleId() {
		try (Session session = sessionSupplier.get()) {
			return session.run("""
					MATCH (a:Article)
					WHERE a.id STARTS WITH 'ART_'
					RETURN a.id AS id
					ORDER BY a.id DESC
					LIMIT 1
					""")
					.list(record -> record.get("id").asString())
					.stream()
					.findFirst()
					.map(this::incrementArticleId)
					.orElse("ART_001");
		}
	}

	public void saveArticle(String id, ArticleUploadRequest request, ProcessingStatus status) {
		try (Session session = sessionSupplier.get()) {
			session.run("""
					CREATE (a:Article {
					  id: $id,
					  label: 'Article',
					  title: $title,
					  source: $source,
					  author: $author,
					  date: $date,
					  body: $body,
					  tags: $tags,
					  status: $status,
					  createdAt: datetime($createdAt)
					})
					""", Values.parameters(
					"id", id,
					"title", request.title(),
					"source", request.source(),
					"author", request.author(),
					"date", request.date(),
					"body", request.body(),
					"tags", request.tags() != null ? request.tags() : List.of(),
					"status", status.name(),
					"createdAt", Instant.now().toString()
			));
		}
	}

	public void updateArticleStatus(
			String id,
			ProcessingStatus status,
			String errorMessage,
			int nodesCreated,
			int relationshipsCreated
	) {
		try (Session session = sessionSupplier.get()) {
			session.run("""
					MATCH (a:Article {id: $id})
					SET a.status = $status,
					    a.errorMessage = $errorMessage,
					    a.nodesCreated = $nodesCreated,
					    a.relationshipsCreated = $relationshipsCreated,
					    a.processedAt = CASE WHEN $status = 'DONE' OR $status = 'FAILED'
					                  THEN datetime($processedAt) ELSE a.processedAt END
					""", Values.parameters(
					"id", id,
					"status", status.name(),
					"errorMessage", errorMessage,
					"nodesCreated", nodesCreated,
					"relationshipsCreated", relationshipsCreated,
					"processedAt", Instant.now().toString()
			));
		}
	}

	public ArticleResponse findArticleById(String id) {
		try (Session session = sessionSupplier.get()) {
			var result = session.run("""
					MATCH (a:Article {id: $id})
					RETURN a
					""", Values.parameters("id", id));

			if (!result.hasNext()) {
				throw new NotFoundException("Article not found: " + id);
			}

			return toArticleResponse(result.single().get("a").asNode());
		}
	}

	public List<ArticleResponse> findAllArticles() {
		try (Session session = sessionSupplier.get()) {
			return session.run("""
					MATCH (a:Article)
					RETURN a
					ORDER BY a.createdAt DESC
					""")
					.list(record -> toArticleResponse(record.get("a").asNode()));
		}
	}

	public void deleteArticle(String id) {
		try (Session session = sessionSupplier.get()) {
			var exists = session.run(
					"MATCH (a:Article {id: $id}) RETURN a",
					Values.parameters("id", id)
			);
			if (!exists.hasNext()) {
				throw new NotFoundException("Article not found: " + id);
			}

			session.executeWriteWithoutResult(tx -> {
				tx.run("""
						MATCH (a:Article {id: $id})
						DETACH DELETE a
						""", Values.parameters("id", id));

				tx.run("""
						MATCH (n)
						WHERE NOT n:Article
						  AND (n:Person OR n:Organization OR n:Location OR n:Event OR n:Topic)
						  AND NOT (n)--()
						DETACH DELETE n
						""");
			});
		}
	}

	public String loadExistingNodesJson() {
		try (Session session = sessionSupplier.get()) {
			List<Map<String, Object>> nodes = session.run("""
					MATCH (n)
					WHERE n:Person OR n:Organization OR n:Location OR n:Event OR n:Topic OR n:Article
					RETURN labels(n) AS labels, properties(n) AS props
					""")
					.list(record -> {
						Map<String, Object> node = new HashMap<>(record.get("props").asMap(Value::asObject));
						List<Object> labels = record.get("labels").asList(Value::asString);
						if (!labels.isEmpty()) {
							node.putIfAbsent("label", labels.get(0));
						}
						return node;
					});

			try {
				return objectMapper.writeValueAsString(nodes);
			}
			catch (JacksonException ex) {
				throw new IllegalStateException("Failed to serialize existing nodes", ex);
			}
		}
	}

	public int mergeNode(String label, Map<String, Object> properties) {
		if (properties.get("id") == null) {
			return 0;
		}

		Map<String, Object> props = new HashMap<>(properties);
		props.putIfAbsent("label", label);
		String id = props.remove("id").toString();

		try (Session session = sessionSupplier.get()) {
			session.run(
					"MERGE (n:" + label + " {id: $id}) SET n += $props",
					Values.parameters("id", id, "props", props)
			);
			return 1;
		}
	}

	public int mergeRelationship(String from, String to, String type, String context) {
		try (Session session = sessionSupplier.get()) {
			session.run(
					"""
					MATCH (a {id: $from}), (b {id: $to})
					MERGE (a)-[r:%s]->(b)
					SET r.context = $context
					""".formatted(type),
					Values.parameters("from", from, "to", to, "context", context)
			);
			return 1;
		}
	}

	private ArticleResponse toArticleResponse(org.neo4j.driver.types.Node node) {
		return new ArticleResponse(
				node.get("id").asString(),
				getString(node, "title"),
				getString(node, "source"),
				getString(node, "author"),
				getString(node, "date"),
				getString(node, "body"),
				node.containsKey("tags") ? node.get("tags").asList(Value::asString) : List.of(),
				ProcessingStatus.valueOf(getString(node, "status", ProcessingStatus.PENDING.name())),
				getString(node, "errorMessage"),
				parseInstant(node, "createdAt"),
				parseInstant(node, "processedAt"),
				node.containsKey("nodesCreated") ? node.get("nodesCreated").asInt() : 0,
				node.containsKey("relationshipsCreated") ? node.get("relationshipsCreated").asInt() : 0
		);
	}

	private String getString(org.neo4j.driver.types.Node node, String key) {
		return getString(node, key, null);
	}

	private String getString(org.neo4j.driver.types.Node node, String key, String defaultValue) {
		if (!node.containsKey(key) || node.get(key).isNull()) {
			return defaultValue;
		}
		return node.get(key).asString();
	}

	private Instant parseInstant(org.neo4j.driver.types.Node node, String key) {
		if (!node.containsKey(key) || node.get(key).isNull()) {
			return null;
		}
		return Instant.parse(node.get(key).asZonedDateTime().toInstant().toString());
	}

	public List<GraphNodeDto> loadGraphNodes() {
		try (Session session = sessionSupplier.get()) {
			return session.run("""
					MATCH (n)
					WHERE n:Person OR n:Organization OR n:Location OR n:Event OR n:Topic OR n:Article
					OPTIONAL MATCH (a:Article)-[:MENTIONS]->(n)
					WITH n, labels(n)[0] AS nodeLabel, count(a) AS mentions
					RETURN n.id AS id,
					       nodeLabel AS label,
					       coalesce(n.name, n.title, n.id) AS name,
					       nodeLabel AS type,
					       CASE
					         WHEN nodeLabel = 'Article' THEN 30
					         WHEN mentions > 0 THEN mentions * 20
					         ELSE 15
					       END AS relevancy
					ORDER BY relevancy DESC
					""")
					.list(record -> new GraphNodeDto(
							record.get("id").asString(),
							record.get("label").asString(),
							record.get("name").asString(),
							record.get("type").asString(),
							record.get("relevancy").asInt()
					));
		}
	}

	public List<GraphRelationshipDto> loadGraphRelationships() {
		try (Session session = sessionSupplier.get()) {
			return session.run("""
					MATCH (a)-[r]->(b)
					WHERE (a:Person OR a:Organization OR a:Location OR a:Event OR a:Topic OR a:Article)
					  AND (b:Person OR b:Organization OR b:Location OR b:Event OR b:Topic OR b:Article)
					RETURN a.id AS from, b.id AS to, type(r) AS type
					""")
					.list(record -> new GraphRelationshipDto(
							record.get("from").asString(),
							record.get("to").asString(),
							record.get("type").asString()
					));
		}
	}

	private String incrementArticleId(String currentId) {
		Matcher matcher = ARTICLE_ID_PATTERN.matcher(currentId);
		if (!matcher.matches()) {
			return "ART_001";
		}
		int next = Integer.parseInt(matcher.group(1)) + 1;
		return "ART_%03d".formatted(next);
	}
}
