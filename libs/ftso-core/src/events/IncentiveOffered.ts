import { CONTRACTS } from "../configs/networks";
import { decodeEvent } from "../utils/EncodingUtils";
import { RawEventConstructible } from "./RawEventConstructible";

export class IncentiveOffered extends RawEventConstructible {
  static eventName = "InflationRewardsOffered";
  constructor(data: any) {
    super();
    this.rewardEpochId = Number(data.rewardEpochId);
    this.rangeIncrease = BigInt(data.rangeIncrease);
    this.sampleSizeIncrease = BigInt(data.sampleSizeIncrease);
    this.offerAmount = BigInt(data.offerAmount);
  }

  static fromRawEvent(event: any): IncentiveOffered {
    return decodeEvent<IncentiveOffered>(
      CONTRACTS.FastUpdateIncentiveManager.name,
      IncentiveOffered.eventName,
      event,
      (data: any) => new IncentiveOffered(data)
    );
  }

  // reward epoch id
  rewardEpochId: number;

  // range increased
  rangeIncrease: bigint;

  // sample size increase
  sampleSizeIncrease: bigint;

  // offer value
  offerAmount: bigint;
}
