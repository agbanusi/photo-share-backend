import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { JoinGroupDto } from './dto/join-group.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post()
  createGroup(@Body() createGroupDto: CreateGroupDto, @Req() req) {
    return this.groupsService.createGroup(createGroupDto, req.user.id);
  }

  @Post('join')
  joinGroup(@Body() joinGroupDto: JoinGroupDto, @Req() req) {
    return this.groupsService.joinGroup(joinGroupDto, req.user.id);
  }

  @Get('my')
  getMyGroups(@Req() req) {
    return this.groupsService.getMyGroups(req.user.id);
  }

  @Get(':id')
  getGroupById(@Param('id') id: string, @Req() req) {
    return this.groupsService.getGroupById(id, req.user.id);
  }

  @Delete(':id')
  deleteGroup(@Param('id') id: string, @Req() req) {
    return this.groupsService.deleteGroup(id, req.user.id);
  }
}
