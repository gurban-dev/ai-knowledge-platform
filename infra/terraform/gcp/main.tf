terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.40"
    }
  }
}

variable "project_id" { type = string }
variable "region" {
  type    = string
  default = "us-central1"
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Conceptual production topology — expand with networking/IAM before apply.
resource "google_sql_database_instance" "akp" {
  name             = "akp-pg"
  database_version = "POSTGRES_16"
  region           = var.region
  settings {
    tier = "db-custom-2-7680"
    ip_configuration {
      ipv4_enabled = false
    }
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
    }
  }
  deletion_protection = true
}

resource "google_redis_instance" "akp" {
  name           = "akp-redis"
  tier           = "STANDARD_HA"
  memory_size_gb = 5
  region         = var.region
}

resource "google_storage_bucket" "documents" {
  name                        = "${var.project_id}-akp-documents"
  location                    = var.region
  uniform_bucket_level_access = true
  versioning { enabled = true }
}

output "notes" {
  value = "Wire GKE Workload Identity, Secret Manager, and private Service Networking before production apply."
}
