import { Module } from "@nestjs/common";
import { AdsController } from "./ads.controller";
import { AdsService } from "./ads.service";
import { RecoveryModule } from "../recovery/recovery.module";

@Module({
  imports: [RecoveryModule], // IMPORTANT
  controllers: [AdsController],
  providers: [AdsService],
})
export class AdsModule {}