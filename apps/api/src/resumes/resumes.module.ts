import { Module } from "@nestjs/common";
import { ResumesService } from "./resumes.service.js";
import { ResumesController } from "./resumes.controller.js";

@Module({
  controllers: [ResumesController],
  providers: [ResumesService],
  exports: [ResumesService],
})
export class ResumesModule {}
