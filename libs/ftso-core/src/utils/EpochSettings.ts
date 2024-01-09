export class EpochSettings {
  constructor(
    readonly rewardEpochStartSec: number,
    readonly rewardEpochDurationSec: number,
    readonly firstVotingEpochStartSec: number,
    readonly votingEpochDurationSec: number
  ) {}

  votingEpochForTime(unixMilli: number): number {
    const unixSeconds = Math.floor(unixMilli / 1000);
    return Math.floor((unixSeconds - this.firstVotingEpochStartSec) / this.votingEpochDurationSec);
  }

  nextVotingEpochStartMs(unixMilli: number): number {
    const currentEpoch = this.votingEpochForTime(unixMilli);
    return this.votingEpochStartMs(currentEpoch + 1);
  }

  votingEpochStartMs(epoch: number) {
    return (this.firstVotingEpochStartSec + epoch * this.votingEpochDurationSec) * 1000;
  }

  revealDeadlineSec(epoch: number) {
    return this.votingEpochStartMs(epoch) + (this.votingEpochDurationSec * 1000) / 2;
  }

  rewardEpochForTime(unixMilli: number): number {
    const unixSeconds = Math.floor(unixMilli / 1000);
    return Math.floor((unixSeconds - this.rewardEpochStartSec) / this.rewardEpochDurationSec);
  }

  rewardEpochStartMs(epoch: number) {
    return (this.rewardEpochStartSec + epoch * this.rewardEpochDurationSec) * 1000;
  }

  nextRewardEpochStartMs(unixMilli: number): number {
    const currentEpoch = this.rewardEpochForTime(unixMilli);
    const nextEpochStartSec = this.rewardEpochStartSec + (currentEpoch + 1) * this.rewardEpochDurationSec;
    return nextEpochStartSec * 1000;
  }

  rewardEpochForVotingEpoch(epochId: number) {
    const votingEpochStart = this.votingEpochStartMs(epochId);
    return this.rewardEpochForTime(votingEpochStart);
  }
}
