import {
  Controller,
  Get,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Param,
  ParseIntPipe,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { errorString } from "../../../libs/ftso-core/src/utils/error";
import { ExternalResponse, PDPResponse, PDPResponseStatusEnum } from "./dto/data-provider-responses.dto";
import { FtsoCalculatorService } from "./ftso-calculator.service";
import { sleepFor } from "./utils/time";
import { IPayloadMessage, PayloadMessage } from "../../../libs/ftso-core/src/utils/PayloadMessage";
import { FTSO2_PROTOCOL_ID } from "../../../libs/ftso-core/src/utils/EncodingUtils";


enum ApiTagsEnum {
  PDP = "FTSO Protocol data provider",
  EXTERNAL = "External User Facing API",
}

@Controller("")
export class FtsoCalculatorController {
  private readonly logger = new Logger(FtsoCalculatorController.name);
  constructor(private readonly ftsoCalculatorService: FtsoCalculatorService) {}

  // Protocol Data Provider APIs

  @ApiTags(ApiTagsEnum.PDP)
  @Get("submit1/:votingRoundId")
  async submit1(
    @Param("votingRoundId", ParseIntPipe) votingRoundId: number,
    @Query("signingAddress") signingAddress: string
  ): Promise<PDPResponse> {
    this.logger.log(`Calling GET on submit1 with param: votingRoundId ${votingRoundId} and query param: signingAddress ${signingAddress}`);
    return {
      status: PDPResponseStatusEnum.OK,
      data: "0x1234",
      additionalData: "0x5678",
    };
  }

  @ApiTags(ApiTagsEnum.PDP)
  @Get("submit2/:votingRoundId")
  async submit2(
    @Param("votingRoundId", ParseIntPipe) votingRoundId: number,
    @Query("signingAddress") signingAddress: string
  ): Promise<PDPResponse> {
    this.logger.log(`Calling GET on submit2 with param: votingRoundId ${votingRoundId} and query param: signingAddress ${signingAddress}`);
    return {
      status: PDPResponseStatusEnum.OK,
      data: "0x1234",
      additionalData: "0x5678",
    };
  }

  @ApiTags(ApiTagsEnum.PDP)
  @Get("submitSignatures/:votingRoundId")
  async submitSignatures(
    @Param("votingRoundId", ParseIntPipe) votingRoundId: number,
    @Query("signingAddress") signingAddress: string
  ): Promise<PDPResponse> {
    this.logger.log(`Calling GET on submit2 with param: votingRoundId ${votingRoundId} and query param: signingAddress ${signingAddress}`);
    return {
      status: PDPResponseStatusEnum.OK,
      data: "0x1234",
      additionalData: "0x5678",
    };
  }

  @ApiTags(ApiTagsEnum.PDP)
  @Get("submit3/:votingRoundId")
  async submit3(
    @Param("votingRoundId", ParseIntPipe) votingRoundId: number,
    @Query("signingAddress") signingAddress: string
  ): Promise<PDPResponse> {
    this.logger.log(`Calling GET on submit3 with param: votingRoundId ${votingRoundId} and query param: signingAddress ${signingAddress}`);
    throw new InternalServerErrorException("Not used in FTSO protocol")
  }

  // Additional standardized facing APIs

  @ApiTags(ApiTagsEnum.EXTERNAL)
  @Get("signedMerkleTree/:votingRoundId")
  async signedMerkleTree(
    @Param("votingRoundId", ParseIntPipe) votingRoundId: number,
  ): Promise<ExternalResponse> {
    this.logger.log(`Calling GET on signedMerkleTree with param: votingRoundId ${votingRoundId}`);
    throw new InternalServerErrorException("Not used in FTSO protocol")
  }

  ////////////////////////////
  // OLD API

  @Get("commit/:epochId")
  async getCommit(@Param("epochId", ParseIntPipe) epochId: number): Promise<string> {
    this.logger.log(`Getting commit for epoch ${epochId}`);
    const commit = await this.ftsoCalculatorService.getCommit(epochId);
    const msg: IPayloadMessage<string> = {
      protocolId: FTSO2_PROTOCOL_ID,
      votingRoundId: epochId,
      payload: commit,
    };
    const encoded = PayloadMessage.encode(msg);
    const decoded = PayloadMessage.decode(encoded);
    console.log(`Decoded: ${JSON.stringify(decoded)}`);
    return PayloadMessage.encode(msg);
  }

  @Get("reveal/:epochId")
  async getReveal(@Param("epochId", ParseIntPipe) epochId: number): Promise<string> {
    this.logger.log(`Getting reveal for epoch ${epochId}`);
    const reveal = await this.ftsoCalculatorService.getReveal(epochId);
    this.logger.log(`Reveal from service ${epochId}: ${JSON.stringify(reveal)}`);
    if (reveal === undefined) {
      throw new NotFoundException(`Reveal for epoch ${epochId} not found`);
    }

    // TODO: Come up with a proper encoding format
    const serializedReveal = reveal.random.toString() + reveal.prices.slice(2);
    this.logger.log(`Reveal for epoch ${epochId}: ${serializedReveal}`);

    const msg: IPayloadMessage<string> = {
      protocolId: FTSO2_PROTOCOL_ID,
      votingRoundId: epochId,
      payload: serializedReveal,
    };
    return PayloadMessage.encode(msg);
  }

  @Get("result/:epochId")
  async getResult(@Param("epochId", ParseIntPipe) epochId: number): Promise<string | undefined> {
    await sleepFor(2000);
    this.logger.log(`Getting result for epoch ${epochId}`);
    try {
      return await this.ftsoCalculatorService.getResult(epochId);
    } catch (e) {
      this.logger.error(`Error calculating result: ${errorString(e)}`);
      throw new InternalServerErrorException(`Unable to calculate result for epoch ${epochId}`, { cause: e });
    }
  }
}