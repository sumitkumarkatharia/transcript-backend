/*
  Warnings:

  - A unique constraint covering the columns `[meetingId,type]` on the table `search_index` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "public"."organizations_domain_key";

-- CreateIndex
CREATE UNIQUE INDEX "search_index_meetingId_type_key" ON "public"."search_index"("meetingId", "type");
