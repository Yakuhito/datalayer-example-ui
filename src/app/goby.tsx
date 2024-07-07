export type Amount = string | number;
export type HexString = string;
export interface Coin {
  parent_coin_info: string;
  puzzle_hash: string;
  amount: number;
}
export interface CoinSpend {
  coin: Coin;
  puzzle_reveal: HexString
  solution: HexString
}
export interface SpendBundle {
  coin_spends: CoinSpend[]
  aggregated_signature: HexString
}
interface AssetBalanceResp {
  confirmed: string;
  spendable: string;
  spendableCoinCount: number;
}
interface getAssetCoinsParams {
  type: string|null;
  assetId?: string|null;
  includedLocked?: boolean;
  offset?: number;
  limit?: number;
}
interface sendTransactionParams {
  spendBundle: SpendBundle;
}
// stay the same as [transaction_ack](https://docs.chia.net/docs/10protocol/wallet_protocol/#transaction_ack)
enum MempoolInclusionStatus {
  SUCCESS = 1, // Transaction added to mempool
  PENDING = 2, // Transaction not yet added to mempool
  FAILED = 3 // Transaction was invalid and dropped
}
interface TransactionResp {
  status: MempoolInclusionStatus;
  error?: string;
}
interface SignMessageParams {
  message: string;
  publicKey: string;
}
interface TakeOfferParams {
  offer: string;
}
interface AssetAmount {
  assetId: string;
  amount: Amount,
}
interface TransferParams {
  to: string;
  amount: Amount;
  assetId: string;
  memos?: HexString[];
}
interface CreateOfferParams {
  offerAssets: AssetAmount[];
  requestAssets: AssetAmount[];
  fee?: number; // mojo
}
interface WatchAssetParams {
  type: string; // 'cat'
  options: {
    assetId: string;
    symbol: string;
    logo?: string;
  }
}
export interface Wallet {
  chainId(): Promise<string>
  filterUnlockedCoins(params: {coinNames: string[]}): Promise<string[]>
  walletSwitchChain(params: {chainId: string}): Promise<null>
  connect(params?: {eager?: boolean}): Promise<boolean>
  getPublicKeys(params?: {limit?: number, offset?: number}): Promise<string[]>
  signCoinSpends(params: {coinSpends: CoinSpend[]}): Promise<string>
  getAssetBalance(params: {type: string|null, assetId: string|null}): Promise<AssetBalanceResp>
  // getAssetCoins(params: getAssetCoinsParams): Promise<SpendableCoin[]>
  sendTransaction(params: sendTransactionParams): Promise<TransactionResp[]>
  signMessage(params: SignMessageParams): Promise<string>
  transfer(params: TransferParams): Promise<{
    id: string;
  }>
  takeOffer(params: TakeOfferParams): Promise<{
    id: string;
  }>
  createOffer(params: CreateOfferParams): Promise<{
    id: string;
    offer: string;
  }>
  walletWatchAsset (params: WatchAssetParams): Promise<boolean>
}
