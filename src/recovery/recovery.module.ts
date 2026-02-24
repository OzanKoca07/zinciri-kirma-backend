import { Module } from "@nestjs/common";
import { RecoveryService } from "./recovery.service";
import { RecoveryController } from "./recovery.controller";

@Module({
  controllers: [RecoveryController],
  providers: [RecoveryService],
  exports: [RecoveryService], // IMPORTANT: AdsService kullanacak
})
export class RecoveryModule {}