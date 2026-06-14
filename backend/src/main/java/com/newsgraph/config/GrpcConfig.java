package com.newsgraph.config;

import io.grpc.ManagedChannel;
import io.grpc.ManagedChannelBuilder;
import io.grpc.health.v1.HealthGrpc;
import com.newsgraph.grpc.ExtractorGrpc;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class GrpcConfig {

	@Bean(destroyMethod = "shutdownNow")
	public ManagedChannel extractorChannel(
			@Value("${newsgraph.extractor.target:localhost:50051}") String target
	) {
		return ManagedChannelBuilder.forTarget(target)
				.usePlaintext()
				.build();
	}

	@Bean
	public ExtractorGrpc.ExtractorBlockingStub extractorStub(ManagedChannel extractorChannel) {
		return ExtractorGrpc.newBlockingStub(extractorChannel);
	}

	@Bean
	public HealthGrpc.HealthBlockingStub extractorHealthStub(ManagedChannel extractorChannel) {
		return HealthGrpc.newBlockingStub(extractorChannel);
	}
}
