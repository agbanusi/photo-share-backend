import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { GroupsService } from './groups.service';

@Injectable()
export class GroupCleanupService {
  private readonly logger = new Logger(GroupCleanupService.name);

  constructor(private readonly groupsService: GroupsService) {}

  // Run every day at midnight
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredGroups() {
    this.logger.log('Running cleanup job for expired groups');

    try {
      await this.groupsService.deleteExpiredGroups();
      this.logger.log('Group cleanup completed successfully');
    } catch (error) {
      this.logger.error(
        `Error in group cleanup: ${error.message}`,
        error.stack,
      );
    }
  }
}
