# TempMail — Disposable Email Platform 🚀

[![Production Application](https://img.shields.io/badge/Status-Production--Live-green?style=flat-square)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)](https://nodejs.org/)
[![Architecture](https://img.shields.io/badge/Architecture-Event--Driven-orange?style=flat-square)](#)

**TempMail** is a proprietary, enterprise-grade disposable email platform engineered to process high-volume inbound messaging traffic with exceptional speed, security, and low latency. Architected as a highly available distributed system, the application handles burst-heavy webhook ingress, enforces robust email categorization, and renders incoming digital messages dynamically to active client sessions.

[✨ Visit Live Application](https://tempmail-front.onrender.com)

---

## 🏗️ Core Architecture Showcase

This repository serves to document the design patterns, code quality, and engineering principles used to power the production system. The application is built upon an Event-Driven Architecture (EDA) optimized specifically to mitigate heavy disk I/O bottlenecks and data dropouts during ingress traffic spikes.

                [ Inbound Email Traffic ]
                             │
                             ▼
                [ Mailgun Infrastructure ]
                             │  (Asynchronous HTTP Webhook)
                             ▼
                 [ Ingestion Gateway Api ]
                             │
                             ▼
                [ Redis Cache / BullMQ ]  <--- Job Isolation Layer
                             │
                             ▼
                 [ Async Queue Workers ]
                /                       \
               ▼                         ▼
    [ Database Batching Buffer ]     [ Socket.io Server Push ]
               │                         │
               ▼                         ▼
      [ PostgreSQL Store ]        [ React Client Interface ]



### 🧱 Engineering Highlights

*   **Asynchronous Processing Pipeline:** To completely mitigate boundary timeouts, incoming HTTP payloads originating from Mailgun webhooks are immediately validated and decoupled into a high-throughput **Redis / BullMQ** task runner. The gateway drops an instantaneous `200 OK` network confirmation, offloading MIME heavy lifting to background processes.
*   **Relational Database Batching Buffer:** To insulate our **PostgreSQL** layer from concurrent lock issues and thread starvation under heavy traffic, independent workers leverage a batch-buffering processing pipeline via **Drizzle ORM**. Sequential rows are dynamically compiled into structured transaction micro-batches, multiplying write-amplification efficiency.
*   **Instantaneous Push Delivery:** The layout features native real-time synchronization. New messages are evaluated through a localized event dispatcher and broadcast immediately over a stateful **Socket.io** connection directly to the browser UI, eliminating the lag and unnecessary resources associated with old-fashioned client polling routines.
*   **Heuristic Extraction Engines:** Implements proprietary regex and extraction utilities optimized to scrub email content metadata. The ingestion script detects incoming activation codes, parses one-time passwords (OTPs), filters complex multipart alternative layouts, and surfaces core authentication targets instantly.

---

## 🛠️ Technology Stack Breakdown

### Server & System Infrastructure
*   **Ecosystem Execution:** Node.js v18 LTS Runtime
*   **Source Language:** TypeScript (Strict Typing Engine)
*   **API Framework:** Express.js 
*   **Data Tier / Schema Management:** Drizzle ORM paired with PostgreSQL
*   **Distributed Caching & Task Queues:** Redis Engine + BullMQ Scheduler
*   **Web Ingress Integrations:** Secure Cryptographic Signature Validation via Mailgun API Gateway

### UI & Presentation Client
*   **Application Framework:** React.js (Vite Tooling)
*   **Interface Presentation Engine:** Tailwind CSS Architecture
*   **Persistent Live Sockets:** Socket.io-client

---

## 📌 Structural API Blueprint

### Address Generation Scheme
`POST /api/inbox` — Dynamically provisions a fresh virtual routing mailbox domain instance.

### Payload Extraction Pipeline
`GET /api/inbox/:address/messages` — Queries and aggregates structural histories associated with a localized communication stream target.

### Internal Webhook Endpoint
`POST /api/webhooks/mailgun` — High-security communication router accepting and scrubbing streaming verification fields delivered straight from outer networks.

---

## 📄 Operational License

Copyright © 2026. All rights reserved. 

The source code contained within this repository is proprietary and confidential. Unauthorized copying, modification, redistribution, or reuse of this software, via any medium, without explicit written authorization is strictly prohibited.





