package com.newsgraph.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.util.StreamUtils;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Configuration
@EnableConfigurationProperties(GeminiProperties.class)
public class AppConfig {

	@Bean
	public RestClient restClient() {
		return RestClient.create();
	}

	@Bean
	public String extractionSystemPrompt() throws IOException {
		ClassPathResource resource = new ClassPathResource("prompt/extraction-prompt.md");
		return StreamUtils.copyToString(resource.getInputStream(), StandardCharsets.UTF_8);
	}
}
