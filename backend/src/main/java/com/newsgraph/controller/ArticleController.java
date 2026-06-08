package com.newsgraph.controller;

import com.newsgraph.dto.ArticleResponse;
import com.newsgraph.dto.ArticleUploadRequest;
import com.newsgraph.service.ArticleService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import org.springframework.http.HttpStatus;

@RestController
@RequestMapping("/api/articles")
public class ArticleController {

	private final ArticleService articleService;

	public ArticleController(ArticleService articleService) {
		this.articleService = articleService;
	}

	@PostMapping
	public ArticleResponse uploadArticle(@Valid @RequestBody ArticleUploadRequest request) {
		return articleService.uploadAndProcess(request);
	}

	@GetMapping
	public List<ArticleResponse> listArticles() {
		return articleService.listArticles();
	}

	@GetMapping("/{id}")
	public ArticleResponse getArticle(@PathVariable String id) {
		return articleService.getArticle(id);
	}

	@DeleteMapping("/{id}")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void deleteArticle(@PathVariable String id) {
		articleService.deleteArticle(id);
	}

	@PostMapping("/{id}/retry")
	public ArticleResponse retryArticle(@PathVariable String id) {
		return articleService.retryArticle(id);
	}
}
