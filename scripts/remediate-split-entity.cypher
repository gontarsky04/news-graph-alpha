// ===========================================================================
// Remediation: split a wrongly-merged entity back into two nodes (in place).
//
// Context: before the surname-gate / RRF-normalization fix, two different
// people who share a given name (e.g. "Donald Trump" + "Donald Tusk") could be
// auto-merged into ONE :Person node — one name as canonical_name, the other
// living in `aliases`, with BOTH people's relationships hanging off it.
//
// Every relationship in this graph carries `source_article_id` (see
// neo4j_client.py), so we can attribute each edge to the article it came from
// and move the edges that belong to the extracted person onto a fresh node.
//
// Run in Neo4j Browser or cypher-shell. Run the STEPs in order; STEP 0 is
// read-only and produces the values you plug into the `:param` lines.
//
// REQUIRES APOC (apoc.refactor.*) for the edge rewiring in STEP 2. APOC ships
// with the official neo4j Docker image used by docker-compose, so it's present
// in the default stack. (Aura also bundles APOC core.)
//
// ---------------------------------------------------------------------------
// !! READ BEFORE RUNNING !!
//
//  * Pick the node to KEEP as the one whose canonical_name + embedding you want
//    to preserve. The OTHER person is "extracted" into a brand-new node.
//  * Attribution is per source article. An article that genuinely mentions
//    BOTH people collapsed into a SINGLE edge at merge time — moving it sends
//    the whole edge to one side. For any such article, DON'T list it below;
//    instead delete+reprocess it afterwards (POST /api/articles/{id}/retry) so
//    the fixed linker rebuilds both sides cleanly.
//  * The new node is created WITHOUT an embedding (Cypher can't run the model).
//    STEP 4 backfills it — until then the new node is findable by fulltext but
//    not by vector search.
//  * Take a backup / run inside a transaction you can roll back if possible.
// ===========================================================================


// ---------------------------------------------------------------------------
// STEP 0a — find the conflated node. Adjust the two surnames as needed.
// ---------------------------------------------------------------------------
MATCH (p:Person)
WITH p, [p.canonical_name] + coalesce(p.aliases, []) AS forms
WHERE any(f IN forms WHERE f CONTAINS 'Trump')
  AND any(f IN forms WHERE f CONTAINS 'Tusk')
RETURN p.id AS id, p.canonical_name AS canonical_name, p.aliases AS aliases;


// ---------------------------------------------------------------------------
// STEP 0b — list every article touching that node, with title + the relation
// types it produced, so you can classify each as KEEP vs EXTRACT.
// Set :param keepId first (paste the id from STEP 0a).
// ---------------------------------------------------------------------------
:param keepId => 'PER_PASTE_FROM_STEP_0a';

MATCH (m:Person {id: $keepId})-[r]-()
WITH DISTINCT r.source_article_id AS aid, collect(DISTINCT type(r)) AS relTypes
MATCH (a:Article {id: aid})
RETURN aid AS articleId, a.title AS title, a.datePublished AS date, relTypes
ORDER BY date;


// ---------------------------------------------------------------------------
// STEP 0c — mint a fresh id for the extracted node, then paste it into the
// :param newId line below.
// ---------------------------------------------------------------------------
RETURN 'PER_' + left(replace(randomUUID(), '-', ''), 12) AS suggestedNewId;


// ===========================================================================
// PARAMETERS — fill these in from STEP 0, then run STEP 1..5.
// ===========================================================================
:param keepId          => 'PER_PASTE_FROM_STEP_0a';
:param newId           => 'PER_PASTE_FROM_STEP_0c';
// Canonical name + alias surface-forms that belong to the EXTRACTED person and
// must move off the kept node (copy the Tusk-side strings out of STEP 0a):
:param newCanonical    => 'Donald Tusk';
:param newAliases      => ['Donald Tusk', 'Tusk', 'Tuska', 'Tuskowi', 'Donalda Tuska'];
// Article ids (from STEP 0b) whose edges belong to the EXTRACTED person.
// Omit any article that mentions BOTH people — reprocess those instead.
:param moveArticleIds  => ['ARTICLE_ID_1', 'ARTICLE_ID_2'];


// ---------------------------------------------------------------------------
// STEP 1 — create the extracted node (no embedding yet; STEP 4 backfills it).
// ---------------------------------------------------------------------------
MATCH (keep:Person {id: $keepId})            // guard: keepId must exist
CREATE (t:Person {
    id:             $newId,
    canonical_name: $newCanonical,
    aliases:        $newAliases,
    createdAt:      datetime()
})
RETURN t.id AS createdId, t.canonical_name AS canonical_name;


// ---------------------------------------------------------------------------
// STEP 2 — rewire the extracted person's edges from the kept node onto the new
// node, preserving relationship type, direction and all properties.
//   2a: OUTGOING edges  (keep)-[r]->(x)   -> change START to new node
//   2b: INCOMING edges  (x)-[r]->(keep)   -> change END   to new node
//       (MENTIONS edges are Article->Person, so they're handled by 2b)
// ---------------------------------------------------------------------------
// 2a — outgoing
MATCH (m:Person {id: $keepId})-[r]->()
WHERE r.source_article_id IN $moveArticleIds
WITH collect(r) AS rels
MATCH (t:Person {id: $newId})
UNWIND rels AS r
CALL apoc.refactor.from(r, t) YIELD output
RETURN count(*) AS movedOutgoing;

// 2b — incoming (includes MENTIONS)
MATCH ()-[r]->(m:Person {id: $keepId})
WHERE r.source_article_id IN $moveArticleIds
WITH collect(r) AS rels
MATCH (t:Person {id: $newId})
UNWIND rels AS r
CALL apoc.refactor.to(r, t) YIELD output
RETURN count(*) AS movedIncoming;


// ---------------------------------------------------------------------------
// STEP 3 — strip the extracted person's alias forms off the kept node.
// ---------------------------------------------------------------------------
MATCH (m:Person {id: $keepId})
SET m.aliases = [x IN coalesce(m.aliases, []) WHERE NOT x IN $newAliases]
RETURN m.id AS id, m.canonical_name AS canonical_name, m.aliases AS aliases;


// ---------------------------------------------------------------------------
// STEP 4 — backfill the new node's embedding (run OUTSIDE Cypher).
// Cypher can't run the MMLW model, so embed the canonical name with the same
// `embed_passage` the pipeline uses and write it back. From `extractor/`:
//
//   uv run python - <<'PY'
//   from newsgraph.linking.embeddings import embed_passage
//   from newsgraph.storage.neo4j_client import Neo4jClient
//   NEW_ID, NAME = "PER_PASTE_FROM_STEP_0c", "Donald Tusk"
//   c = Neo4jClient()
//   c.execute_write(
//       "MATCH (n:Person {id:$id}) SET n.embedding = $e",
//       {"id": NEW_ID, "e": embed_passage(NAME)},
//   )
//   c.close()
//   print("embedding written")
//   PY
//
// Until this runs the new node is fulltext-searchable but invisible to vector
// search (so it can't be a vector candidate for future mentions).
// ---------------------------------------------------------------------------


// ---------------------------------------------------------------------------
// STEP 5 — verify the split.
// ---------------------------------------------------------------------------
// 5a — the two nodes, their names/aliases, and whether embeddings are present
MATCH (p:Person) WHERE p.id IN [$keepId, $newId]
RETURN p.id AS id, p.canonical_name AS canonical_name, p.aliases AS aliases,
       p.embedding IS NOT NULL AS hasEmbedding;

// 5b — edge counts per node (should reflect the article split)
MATCH (p:Person) WHERE p.id IN [$keepId, $newId]
OPTIONAL MATCH (p)-[r]-()
RETURN p.id AS id, p.canonical_name AS canonical_name, count(r) AS degree;

// 5c — sanity: no remaining edge on the kept node references a moved article
MATCH (m:Person {id: $keepId})-[r]-()
WHERE r.source_article_id IN $moveArticleIds
RETURN count(r) AS leftoverShouldBeZero;
