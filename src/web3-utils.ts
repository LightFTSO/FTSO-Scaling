import { readFileSync } from "fs";
import glob from "glob";
import Web3 from "web3";
import { Account } from "web3-core";
import { BareSignature, BlockData, TxData } from "./voting-interfaces";
import { retry } from "./utils/retry";

export function getWeb3(rpcLink: string, logger?: any): Web3 {
  const web3 = new Web3();
  if (rpcLink.startsWith("http")) {
    web3.setProvider(new Web3.providers.HttpProvider(rpcLink));
  } else if (rpcLink.startsWith("ws")) {
    let provider = new Web3.providers.WebsocketProvider(rpcLink, {
      // @ts-ignore
      clientConfig: {
        keepalive: true,
        keepaliveInterval: 60000, // milliseconds
      },
      reconnect: {
        auto: true,
        delay: 2500,
        onTimeout: true,
      },
    });
    provider.on("close", () => {
      if (logger) {
        logger.error(`WebSocket connection closed.`);
      }
    });
    web3.setProvider(provider);
  }
  web3.eth.handleRevert = true;
  return web3;
}

export async function loadContract<ContractType>(web3: Web3, address: string, name: string) {
  if (!address) throw Error(`Address for ${name} not provided`);
  const abiPath = await relativeContractABIPathForContractName(name);
  const contract = new web3.eth.Contract(getAbi(`artifacts/${abiPath}`), address);
  return contract as ContractType;
}

export function getAccount(web3: Web3, privateKey: string): Account {
  if (privateKey.indexOf("0x") != 0) {
    privateKey = "0x" + privateKey;
  }
  return web3.eth.accounts.privateKeyToAccount(privateKey);
}

export function signMessage(web3: Web3, message: string, privateKey: string): BareSignature {
  const signature = web3.eth.accounts.sign(message, privateKey);
  return {
    v: parseInt(signature.v, 16),
    r: signature.r,
    s: signature.s,
  };
}

/**
 * Returns the address (lowercase) which generated the {@link signature} for the provided {@link message}.
 *
 * Note that an invalid signature, or a signature from a different message, will still result in some public
 * key (address) being recovered. To ensure the signature is correct this will need to be compared to the expected signer.
 */
export function recoverSigner(web3: Web3, message: string, signature: BareSignature): string {
  return web3.eth.accounts.recover(message, "0x" + signature.v.toString(16), signature.r, signature.s).toLowerCase();
}

export function getAbi(abiPath: string) {
  let abi = JSON.parse(readFileSync(abiPath).toString());
  if (abi.abi) {
    abi = abi.abi;
  }
  return abi;
}

export async function relativeContractABIPathForContractName(
  name: string,
  artifactsRoot = "artifacts"
): Promise<string> {
  return new Promise((resolve, reject) => {
    glob(`contracts/**/${name}.sol/${name}.json`, { cwd: artifactsRoot }, (er: any, files: string[] | null) => {
      if (er) {
        reject(er);
      } else {
        if (files && files.length === 1) {
          resolve(files[0]);
        } else {
          reject(files);
        }
      }
    });
  });
}

/**
 * Retrieves block for a given {@link blockNumber} and returns {@link BlockData} containing only transactions to the specified {@link contractAddresses}.
 */
export async function getFilteredBlock(
  web3: Web3,
  blockNumber: number,
  contractAddresses: string[]
): Promise<BlockData> {
  const rawBlock = await web3.eth.getBlock(blockNumber, true);
  if (rawBlock === null) throw new Error(`Block ${blockNumber} not found`);
  if (rawBlock.number === null) throw new Error(`Block ${blockNumber} is still pending.`);

  const relevantContracts = new Set(contractAddresses);
  const relevantTransactions = rawBlock.transactions.filter(tx => tx.to != null && relevantContracts.has(tx.to));
  const getReceipts = relevantTransactions.map(tx => retry(async () => web3.eth.getTransactionReceipt(tx.hash)));
  const receipts = await Promise.all(getReceipts);

  receipts.forEach((receipt, i) => {
    if (receipt === null)
      throw new Error(
        `Receipt for transaction ${rawBlock.transactions[i].hash} not found, block: ${JSON.stringify(
          rawBlock,
          null,
          2
        )}\n Tx ${JSON.stringify(rawBlock.transactions[i], null, 2)}\n Tx input: ${web3.utils.toAscii(
          rawBlock.transactions[i].input
        )}`
      );
  });

  const blockData: BlockData = {
    number: rawBlock.number,
    timestamp: parseInt("" + rawBlock.timestamp, 10),
    transactions: relevantTransactions.map((tx, i) => {
      const txData: TxData = {
        blockNumber: tx.blockNumber!,
        hash: tx.hash,
        input: tx.input,
        from: tx.from,
        to: tx.to,
        value: tx.value,
        receipt: receipts[i],
      };
      return txData;
    }),
  };
  return blockData;
}
