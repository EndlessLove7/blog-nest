import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('服务')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: '检查服务是否正常运行' })
  @ApiOkResponse({ description: '服务问候消息' })
  getHello(): string {
    return this.appService.getHello();
  }
}
