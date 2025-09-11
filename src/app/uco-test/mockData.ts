// Mock UCO data for local development
export const mockUCO = {
  components: {
    user: {
      id: 1,
      displayName: "Steve (Test Mode)",
      email: "steve@example.com",
      bio: "Developer",
      intis_earned_total: 150,
      github_username: "steve",
      permissions: ["admin"],
      profile_image: null
    },
    topic: {
      uuid: "mock-draft-1",
      title: "UCO Implementation Guide",
      category_name: "Technical",
      topic_type: "Documentation",
      status: "draft",
      stage: "editing",
      word_count: 1250,
      version: 3,
      updated_at: "2025-08-26T17:30:00Z",
      subscribed_fields: ["title", "content", "category"]
    },
    drafts: [
      {
        uuid: "mock-draft-1",
        title: "UCO Implementation Guide",
        category: "Technical",
        type: "Documentation",
        status: "draft",
        updated_at: "2025-08-26T17:30:00Z"
      },
      {
        uuid: "mock-draft-2", 
        title: "Session Persistence Architecture",
        category: "Technical",
        type: "Architecture",
        status: "draft",
        updated_at: "2025-08-26T16:00:00Z"
      },
      {
        uuid: "mock-draft-3",
        title: "Knowledge Graph Integration",
        category: "Technical",
        type: "Planning",
        status: "review",
        updated_at: "2025-08-26T14:00:00Z"
      }
    ],
    navigation: {
      currentRoute: "/uco-test",
      history: [
        { route: "/", timestamp: "2025-08-26T17:00:00Z" },
        { route: "/create", timestamp: "2025-08-26T17:10:00Z" },
        { route: "/uco-test", timestamp: "2025-08-26T17:20:00Z" }
      ],
      breadcrumbs: ["home", "uco-test"]
    }
  },
  metadata: {
    lastUpdate: new Date().toISOString(),
    subscriptions: ["title", "content", "category"],
    totalFields: 15,
    confidence: 0.85,
    privacy: "private"
  }
};