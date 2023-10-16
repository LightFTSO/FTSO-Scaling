import BN from "bn.js";
import { FTSOClient } from "./FTSOClient";
import { getLogger } from "./utils/logger";
import { errorString } from "./utils/error";
import { Received } from "./BlockIndex";
import { FinalizeData, SignatureData } from "./lib/voting-interfaces";
import { toBN } from "./lib/voting-utils";
import _ from "lodash";
import { BlockIndexer } from "./rewards/BlockIndexer";

export class Finalizer {
  private readonly logger = getLogger(Finalizer.name);
  private readonly indexer: BlockIndexer;

  constructor(private client: FTSOClient) {
    this.indexer = client.index as BlockIndexer;
  }

  readonly signaturesByEpoch = new Map<number, SignatureData[]>();
  readonly rewardSignaturesByEpoch = new Map<number, SignatureData[]>();

  finalizedEpoch = 0;
  finalizedRewardEpoch = 0;

  async run() {
    this.indexer.on(Received.Finalize, (fd: FinalizeData) => {
      this.finalizedEpoch = Math.max(this.finalizedEpoch, fd.epochId);
      this.signaturesByEpoch.delete(fd.epochId);
    });

    this.indexer.on(Received.Signature, async (signature: SignatureData) => {
      this.logger.info(`Received signature for epoch ${signature.epochId}.`);
      if (signature.epochId <= this.finalizedEpoch) return;

      const signaturesForEpoch = this.signaturesByEpoch.get(signature.epochId) ?? [];
      signaturesForEpoch.push(signature);
      this.signaturesByEpoch.set(signature.epochId, signaturesForEpoch);

      const rewardEpoch = this.client.epochs.rewardEpochIdForPriceEpochId(signature.epochId);
      const weightThreshold = await this.client.provider.thresholdForRewardEpoch(rewardEpoch);
      const voterWeights = await this.client.provider.getVoterWeightsForRewardEpoch(rewardEpoch);

      const res = await this.checkSignatures(signaturesForEpoch, weightThreshold, voterWeights);
      if (res !== undefined) {
        const [mroot, sigs] = res;
        if (await this.tryFinalizePriceEpoch(signature.epochId, mroot, [...sigs.values()])) {
          this.finalizedEpoch = Math.max(this.finalizedEpoch, signature.epochId);
        }

        return true;
      }
    });

    this.indexer.on(Received.RewardFinalize, (fd: FinalizeData) => {
      this.finalizedRewardEpoch = Math.max(this.finalizedRewardEpoch, fd.epochId);
      this.rewardSignaturesByEpoch.delete(fd.epochId);
    });

    this.indexer.on(Received.RewardSignature, async (signature: SignatureData) => {
      this.logger.info(`Received reward signature for epoch ${signature.epochId}.`);
      if (signature.epochId <= this.finalizedRewardEpoch) return;

      const signaturesForEpoch = this.rewardSignaturesByEpoch.get(signature.epochId) ?? [];
      signaturesForEpoch.push(signature);
      this.rewardSignaturesByEpoch.set(signature.epochId, signaturesForEpoch);

      const weightThreshold = await this.client.provider.thresholdForRewardEpoch(signature.epochId);
      const voterWeights = await this.client.provider.getVoterWeightsForRewardEpoch(signature.epochId);

      const res = await this.checkSignatures(signaturesForEpoch, weightThreshold, voterWeights);
      if (res !== undefined) {
        const [mroot, sigs] = res;
        if (await this.tryFinalizeRewardEpoch(signature.epochId, mroot, [...sigs.values()])) {
          this.finalizedRewardEpoch = Math.max(this.finalizedRewardEpoch, signature.epochId);
        }

        return true;
      }
    });

    this.indexer.run();
  }

  /**
   * Once sufficient voter weight in received signatures is observed, will call finalize.
   */
  private async checkSignatures(
    signatures: SignatureData[],
    weightThreshold: BN,
    voterWeights: Map<string, BN>
  ): Promise<[string, SignatureData[]] | undefined> {
    const signaturesByMerkleRoot = _.groupBy(signatures, s => s.merkleRoot);
    // We don't know what the correct merkle root for the epoch is,
    // so we'll try all and use the one with enough weight behind it for finalization.
    for (const mroot in signaturesByMerkleRoot) {
      let totalWeight = toBN(0);
      const validatedSignatures = new Map<string, SignatureData>();
      for (const signature of signaturesByMerkleRoot[mroot]) {
        const signer = await this.client.provider.recoverSigner(mroot, signature);
        // Deduplicate signers, since the same signature can in theory be published multiple times by different accounts.
        if (validatedSignatures.has(signer)) continue;

        const weight = voterWeights.get(signer) ?? toBN(0);
        // Weight == 0 could mean that the signer is not registered for this reward epoch OR that the signature is invalid.
        // We skip the signature in both cases.
        if (weight.gt(toBN(0))) {
          validatedSignatures.set(signer, signature);
          totalWeight = totalWeight.add(weight);

          if (totalWeight.gt(weightThreshold)) {
            return [mroot, Array.from(validatedSignatures.values())];
          }
        }
      }
    }

    return undefined;
  }

  private async tryFinalizePriceEpoch(
    priceEpochId: number,
    merkleRoot: string,
    signatures: SignatureData[]
  ): Promise<boolean> {
    try {
      this.logger.info(`Submitting finalization transaction for epoch ${priceEpochId}.`);
      await this.client.provider.finalize(priceEpochId, merkleRoot, signatures);
      this.logger.info(`Successfully submitted finalization transaction for epoch ${priceEpochId}.`);
      return true;
    } catch (e) {
      // this.logger.info(`Failed to submit finalization transaction: ${errorString(e)}`);
      return false;
    }
  }

  private async tryFinalizeRewardEpoch(
    rewardEpoch: number,
    merkleRoot: string,
    signatures: SignatureData[]
  ): Promise<boolean> {
    try {
      this.logger.info(`Submitting finalization transaction for reward epoch ${rewardEpoch}.`);
      await this.client.provider.finalizeRewards(rewardEpoch, merkleRoot, signatures);
      this.logger.info(`Successfully submitted finalization transaction for reward epoch ${rewardEpoch}.`);
      return true;
    } catch (e) {
      this.logger.info(`Failed to submit finalization transaction: ${errorString(e)}`);
      return false;
    }
  }
}
