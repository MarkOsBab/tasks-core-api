import { BaseService } from '../base/base.service';
import {
  ProjectLearningRepository,
  projectLearningRepository,
} from './project-learning.repository';
import type { ProjectLearningWithRelations } from './project-learning.types';

/**
 * Read side of the institutional memory the MCP writes with add_learning: the learnings panel
 * lists and filters them, and can retire an entry (soft delete) so agents stop being fed it.
 */
class ProjectLearningService extends BaseService<ProjectLearningWithRelations> {
  constructor(learnings: ProjectLearningRepository) {
    super(learnings);
  }
}

export const projectLearningService = new ProjectLearningService(projectLearningRepository);
