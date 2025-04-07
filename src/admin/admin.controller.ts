import { Controller, Get, Delete, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { AdminService } from '../admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('groups')
  getAllGroups(@Req() req) {
    return this.adminService.getAllGroups(req.user.id);
  }

  @Get('users')
  getAllUsers(@Req() req) {
    return this.adminService.getAllUsers(req.user.id);
  }

  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string, @Req() req) {
    return this.adminService.deleteGroup(id, req.user.id);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @Req() req) {
    return this.adminService.deleteUser(id, req.user.id);
  }

  @Get('stats')
  getSystemStats(@Req() req) {
    return this.adminService.getSystemStats(req.user.id);
  }
}
