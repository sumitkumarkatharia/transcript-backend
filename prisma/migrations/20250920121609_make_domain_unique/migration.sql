-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('USER', 'ADMIN', 'ORG_ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "public"."MeetingStatus" AS ENUM ('SCHEDULED', 'LIVE', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'ERROR');

-- CreateEnum
CREATE TYPE "public"."ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'RETRYING');

-- CreateEnum
CREATE TYPE "public"."SummaryType" AS ENUM ('EXECUTIVE', 'DETAILED', 'ACTION_ITEMS', 'KEY_DECISIONS', 'REAL_TIME');

-- CreateEnum
CREATE TYPE "public"."Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "public"."ActionItemStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OVERDUE');

-- CreateEnum
CREATE TYPE "public"."IntegrationType" AS ENUM ('GOOGLE_CALENDAR', 'OUTLOOK_CALENDAR', 'SLACK', 'MICROSOFT_TEAMS', 'SALESFORCE', 'HUBSPOT', 'ZOOM', 'GOOGLE_MEET');

-- CreateEnum
CREATE TYPE "public"."SearchIndexType" AS ENUM ('TRANSCRIPT', 'SUMMARY', 'ACTION_ITEM', 'TOPIC', 'PARTICIPANT');

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "hashedPassword" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."organization_settings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "autoJoinEnabled" BOOLEAN NOT NULL DEFAULT true,
    "recordingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "aiSummaryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "languageDetection" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organization_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."meetings" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "bbbMeetingId" TEXT NOT NULL,
    "bbbMeetingName" TEXT NOT NULL,
    "bbbRecordingId" TEXT,
    "moderatorPassword" TEXT NOT NULL,
    "attendeePassword" TEXT NOT NULL,
    "joinUrl" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "duration" INTEGER,
    "status" "public"."MeetingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "hostId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "audioFileUrl" TEXT,
    "recordingUrl" TEXT,
    "botJoined" BOOLEAN NOT NULL DEFAULT false,
    "botJoinedAt" TIMESTAMP(3),
    "botLeftAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."meeting_participants" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "bbbUserId" TEXT NOT NULL,
    "joinTime" TIMESTAMP(3),
    "leaveTime" TIMESTAMP(3),
    "speakingTime" INTEGER,
    "isModerator" BOOLEAN NOT NULL DEFAULT false,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    "hasVideo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "meeting_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audio_chunks" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "chunkNumber" INTEGER NOT NULL,
    "startTimestamp" DOUBLE PRECISION NOT NULL,
    "endTimestamp" DOUBLE PRECISION NOT NULL,
    "audioUrl" TEXT NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "transcribed" BOOLEAN NOT NULL DEFAULT false,
    "transcribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audio_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."transcripts" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "speakerId" TEXT,
    "speakerName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "startTimestamp" DOUBLE PRECISION NOT NULL,
    "endTimestamp" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "processingStatus" "public"."ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "embedding" DOUBLE PRECISION[] DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."meeting_summaries" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "type" "public"."SummaryType" NOT NULL,
    "content" TEXT NOT NULL,
    "keyPoints" TEXT[],
    "participants" TEXT[],
    "model" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."action_items" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedTo" TEXT,
    "assignedToEmail" TEXT,
    "dueDate" TIMESTAMP(3),
    "priority" "public"."Priority" NOT NULL DEFAULT 'MEDIUM',
    "status" "public"."ActionItemStatus" NOT NULL DEFAULT 'OPEN',
    "sourceTimestamp" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "action_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."meeting_topics" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mentions" INTEGER NOT NULL DEFAULT 1,
    "sentiment" DOUBLE PRECISION,
    "keywords" TEXT[],
    "timeSpent" INTEGER,
    "relevanceScore" DOUBLE PRECISION,

    CONSTRAINT "meeting_topics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."meeting_analytics" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "totalSpeakingTime" INTEGER NOT NULL,
    "participantStats" JSONB NOT NULL,
    "interruptionCount" INTEGER NOT NULL DEFAULT 0,
    "questionCount" INTEGER NOT NULL DEFAULT 0,
    "overallSentiment" DOUBLE PRECISION,
    "engagementScore" DOUBLE PRECISION,
    "energyLevel" DOUBLE PRECISION,
    "topTopics" TEXT[],
    "actionItemCount" INTEGER NOT NULL DEFAULT 0,
    "decisionCount" INTEGER NOT NULL DEFAULT 0,
    "talkTimeDistribution" JSONB NOT NULL,
    "meetingPace" DOUBLE PRECISION,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailSummaries" BOOLEAN NOT NULL DEFAULT true,
    "slackNotifications" BOOLEAN NOT NULL DEFAULT false,
    "realTimeAlerts" BOOLEAN NOT NULL DEFAULT true,
    "summaryStyle" TEXT NOT NULL DEFAULT 'concise',
    "languages" TEXT[] DEFAULT ARRAY['en']::TEXT[],
    "autoTranscription" BOOLEAN NOT NULL DEFAULT true,
    "calendarSync" BOOLEAN NOT NULL DEFAULT false,
    "crmSync" BOOLEAN NOT NULL DEFAULT false,
    "dataRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "shareAnalytics" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."integrations" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "public"."IntegrationType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "credentials" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."search_index" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "type" "public"."SearchIndexType" NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "embedding" DOUBLE PRECISION[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_index_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "public"."refresh_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_domain_key" ON "public"."organizations"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "organization_settings_organizationId_key" ON "public"."organization_settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "meetings_bbbMeetingId_key" ON "public"."meetings"("bbbMeetingId");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_participants_meetingId_bbbUserId_key" ON "public"."meeting_participants"("meetingId", "bbbUserId");

-- CreateIndex
CREATE INDEX "audio_chunks_meetingId_startTimestamp_idx" ON "public"."audio_chunks"("meetingId", "startTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "audio_chunks_meetingId_chunkNumber_key" ON "public"."audio_chunks"("meetingId", "chunkNumber");

-- CreateIndex
CREATE INDEX "transcripts_meetingId_startTimestamp_idx" ON "public"."transcripts"("meetingId", "startTimestamp");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_analytics_meetingId_key" ON "public"."meeting_analytics"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_userId_key" ON "public"."user_settings"("userId");

-- CreateIndex
CREATE INDEX "search_index_meetingId_type_idx" ON "public"."search_index"("meetingId", "type");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."organization_settings" ADD CONSTRAINT "organization_settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meetings" ADD CONSTRAINT "meetings_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meetings" ADD CONSTRAINT "meetings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meetings" ADD CONSTRAINT "meetings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meeting_participants" ADD CONSTRAINT "meeting_participants_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meeting_participants" ADD CONSTRAINT "meeting_participants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audio_chunks" ADD CONSTRAINT "audio_chunks_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."transcripts" ADD CONSTRAINT "transcripts_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meeting_summaries" ADD CONSTRAINT "meeting_summaries_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."action_items" ADD CONSTRAINT "action_items_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meeting_topics" ADD CONSTRAINT "meeting_topics_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meeting_analytics" ADD CONSTRAINT "meeting_analytics_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "public"."meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_settings" ADD CONSTRAINT "user_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."integrations" ADD CONSTRAINT "integrations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
