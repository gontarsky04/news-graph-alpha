package com.newsgraph.config;

import org.neo4j.driver.Driver;
import org.neo4j.driver.Session;
import org.neo4j.driver.SessionConfig;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.function.Supplier;

@Configuration
public class Neo4jConfig {

	@Value("${spring.data.neo4j.database}")
	private String database;

	@Bean
	public Supplier<Session> neo4jSessionSupplier(Driver driver) {
		return () -> driver.session(SessionConfig.forDatabase(database));
	}
}
