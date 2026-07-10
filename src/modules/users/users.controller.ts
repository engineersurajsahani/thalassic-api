import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post, Put } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UpdateSecurityDto } from './dto/update-security.dto';
import { CreateSeaServiceDto } from './dto/create-sea-service.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Put('profile')
  @HttpCode(HttpStatus.OK)
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Put('security')
  @HttpCode(HttpStatus.OK)
  async updateSecurity(@CurrentUser() user: any, @Body() dto: UpdateSecurityDto) {
    return this.usersService.updateSecurity(user.sub, dto);
  }

  @Post('sea-service')
  @HttpCode(HttpStatus.CREATED)
  async addSeaService(@CurrentUser() user: any, @Body() dto: CreateSeaServiceDto) {
    return this.usersService.addSeaService(user.sub, dto);
  }

  @Delete('sea-service/:id')
  @HttpCode(HttpStatus.OK)
  async deleteSeaService(@CurrentUser() user: any, @Param('id') recordId: string) {
    return this.usersService.deleteSeaService(user.sub, recordId);
  }
}
