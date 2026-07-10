PROJECT_ID ?= daily-report-502008
REGION ?= asia-northeast1
SERVICE ?= daily-report
REPOSITORY ?= daily-report
TAG ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)

IMAGE_NAME := $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(REPOSITORY)/$(SERVICE)
IMAGE := $(IMAGE_NAME):$(TAG)

.PHONY: help install lint typecheck test ci build \
	docker-build docker-push deploy release \
	gcp-setup gcp-auth-docker

help: ## このヘルプを表示
	@grep -E '^[a-zA-Z0-9_-]+:.*##' $(MAKEFILE_LIST) | sed -E 's/:.*##/: /' | sort

## --- アプリケーション ---

install: ## 依存パッケージをインストール
	npm ci

lint: ## ESLintを実行
	npm run lint

typecheck: ## 型チェックを実行
	npm run typecheck

test: ## テストを実行
	npm run test

ci: install lint typecheck test ## CIで実行する検証一式（lint / typecheck / test）

build: ## Next.jsアプリをローカルでビルド
	npm run build

## --- Dockerイメージ ---

docker-build: ## Cloud Run用Dockerイメージをビルド
	docker build -t $(IMAGE) .

docker-push: ## Artifact Registryへイメージをpush
	docker push $(IMAGE)

## --- GCPセットアップ（初回のみ） ---

gcp-setup: ## 必要なAPI有効化とArtifact Registryリポジトリの作成（初回のみ実行）
	gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
		--project=$(PROJECT_ID)
	gcloud artifacts repositories create $(REPOSITORY) \
		--repository-format=docker \
		--location=$(REGION) \
		--project=$(PROJECT_ID) \
		--description="daily-report container images" || true

gcp-auth-docker: ## Artifact RegistryへのDocker認証設定
	gcloud auth configure-docker $(REGION)-docker.pkg.dev

## --- デプロイ ---

deploy: docker-build gcp-auth-docker docker-push ## イメージのビルド・push・Cloud Runへのデプロイ
	gcloud run deploy $(SERVICE) \
		--image=$(IMAGE) \
		--region=$(REGION) \
		--project=$(PROJECT_ID) \
		--platform=managed \
		--allow-unauthenticated

release: ci build deploy ## lint/typecheck/test → build → deploy を一気通貫で実行
