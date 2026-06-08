// Run once in Neo4j Browser (Aura -> Connect -> Open)
// Creates unique constraints for all node types used by NewsGraph.

CREATE CONSTRAINT person_id IF NOT EXISTS
FOR (n:Person) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT organization_id IF NOT EXISTS
FOR (n:Organization) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT location_id IF NOT EXISTS
FOR (n:Location) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT event_id IF NOT EXISTS
FOR (n:Event) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT topic_id IF NOT EXISTS
FOR (n:Topic) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT article_id IF NOT EXISTS
FOR (n:Article) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT analysis_id IF NOT EXISTS
FOR (n:Analysis) REQUIRE n.id IS UNIQUE;

CREATE CONSTRAINT snapshot_id IF NOT EXISTS
FOR (n:Snapshot) REQUIRE n.id IS UNIQUE;
