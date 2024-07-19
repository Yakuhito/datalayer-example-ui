"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE, NETWORK_PREFIX } from "./config";
import { bech32m } from "bech32";
import { useSearchParams } from "next/navigation";

interface Window {
  ethereum: any;
}

export default function Home() {
  const params = useSearchParams();
  const [gobyInstalled, setGobyInstalled] = useState<boolean | null>(null);
  const [address, setAddress] = useState<string>('');
  const [pk, setPk] = useState<string>('');

  useEffect(() => {
    if(gobyInstalled === null) {
      const chia = (window as any).chia;
      const gobyInstalled_ = chia && chia.isGoby;

      setGobyInstalled(gobyInstalled_); 
      return;
    }

    if (!gobyInstalled) {
      console.log('Goby is not installed :(');
      return;
    }

    (window as any).chia.on("accountChanged", () => {
      window.location.reload()
    });

    (window as any).chia.request({ method: 'connect', params: { eager: true } }).then((connected: boolean) => {
      if(!connected) {
        return;
      }
      
      const puzzle_hash = (window as any).chia.selectedAddress
      const address = bech32m.encode(NETWORK_PREFIX,
        bech32m.toWords(Buffer.from(puzzle_hash, 'hex'))
      )
      // console.log({ address })
      setAddress(address);

      (window as any).chia.request({ method: 'getPublicKeys', params: { limit: 1, offset: 0 } }).then((pk: string) => {
        setPk((pk[0] as string).replace('0x', ''));
      })
    });
  }, [gobyInstalled, setGobyInstalled, address, setAddress]);

  const connectGoby = () => (window as any).chia.request({ method: 'connect', params: { eager: false } }).then((connected: boolean) => {
    if(!connected) {
      return;
    }

    const puzzle_hash = (window as any).chia.selectedAddress
    const address = bech32m.encode(NETWORK_PREFIX,
      bech32m.toWords(Buffer.from(puzzle_hash, 'hex'))
    )
    console.log({ address })
    setAddress(address);

    (window as any).chia.request({ method: 'getPublicKeys', params: { limit: 1, offset: 0 } }).then((pk: string) => {
      setPk((pk[0] as string).replace('0x', ''));
    })
  });

  if(gobyInstalled === null) {
    return <></>;
  }

  if(!params.get('secret')) {
    return <>No secret :|</>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-xl font-medium mb-8">DataLayer Test App</h1>

      {!gobyInstalled ?
        <p>please use a browser with Goby installed</p> :
        (!address || !pk ? <button onClick={connectGoby} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:opacity-80">Connect Goby</button> : <div>
          <p className="pb-2">Goby address: {address}</p>
          <p className="pb-8">Public synthetic key: {pk}</p>
        </div>)
      }

      {address && pk && <MainComponent address={address} userPublicKey={pk} secret={params.get('secret')}/>}
    </main>
  );
}

const TX_PRESS_BUTTON = 'press button below to start tx';

function MainComponent({ address, userPublicKey, secret }: { address: string, userPublicKey: string, secret: string}) {
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [dataStoreInfo, setDataStoreInfo] = useState<'loading' | null | any>('loading');
  const [mintStatus, setMintStatus] = useState('press button to mint');
  const loading = serverInfo === null || dataStoreInfo === 'loading';
  console.log({ loading, serverInfo, dataStoreInfo })
  const [spendAsOption, setSpendAsOption] = useState<'admin' | 'writer' | 'oracle' | 'owner'>('admin');
  const [spendAction, setSpendAction] = useState<'update_metadata' | 'update_ownership' | 'oracle' | 'burn'>('update_metadata');

  const [newRootHash, setNewRootHash] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const [newDelegatedPuzzlesInfos, setNewDelegatedPuzzleInfos] = useState<any[]>([]);

  const [txStatus, setTxStatus] = useState(TX_PRESS_BUTTON);

  const fetchServerInfo = async () => {
    const res = await fetch(`${API_BASE}/info`, {
      headers: {
        'X-Secret': secret
      }
    })

    const info = await res.json();

    setServerInfo(info);
    setNewDelegatedPuzzleInfos([
      {type: 'admin', key: info?.pk},
      {type: 'writer', key: info?.pk},
      {type: 'oracle', puzzle_hash: '11'.repeat(32), fee: 1338}, 
    ]);
  };

  useEffect(() => {
    if(!serverInfo) {
      fetchServerInfo();
    }
  }, [serverInfo, setServerInfo]);

  const DATASTORE_INFO_KEY = 'datastore_info';

  const setDataStoreInfoWithPersistence = (info: any) => {
    setDataStoreInfo(info);
    localStorage.setItem(DATASTORE_INFO_KEY, JSON.stringify(info));

    console.log({ info })
    if(info?.metadata) {
      setNewRootHash(info.metadata.root_hash);
      setNewDescription(info.metadata.description);
      setNewLabel(info.metadata.label);
    }
  };

  useEffect(() => {
    if(dataStoreInfo === 'loading') {
      const info = localStorage.getItem(DATASTORE_INFO_KEY);
      if(info && info !=='undefined') {
        setDataStoreInfoWithPersistence(JSON.parse(info));
      } else {
        setDataStoreInfo(null);
      }
    }
  }, [dataStoreInfo, setDataStoreInfo]);

  if(loading) {
    return (
      <>Loading data...</>
    );
  }

  const launchDataStore = async () => {
    setMintStatus('building mint tx...');
    const resp = await fetch(`${API_BASE}/mint`, {
      method: 'POST',
      body: JSON.stringify({ 
        root_hash: '00'.repeat(32),
        label: "An ordinary store with extraordinary delegation capabilities",
        description: "A freshly-minted datastore",
        owner_address: address,
        fee: 500000000,
        oracle_fee: 1338
       }),
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': secret
      }
    });

    setMintStatus('broadcasting mint tx...');
    const { new_info, coin_spends } = await resp.json();
    const sendResp = await fetch(`${API_BASE}/sing-and-send`, {
      method: 'POST',
      body: JSON.stringify({ 
        coin_spends
       }),
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': secret
      }
    });
    const { err } = await sendResp.json();
    if(err) {
      alert('error when sending tx: ' + err)
      setMintStatus('error sending mint tx');
      return;
    }
    
    setMintStatus('waiting for mint tx to be confirmed...');

    const coin = coin_spends[coin_spends.length - 1].coin;
    let coinResp = await fetch(`${API_BASE}/coin-confirmed`, {
      method: 'POST',
      body: JSON.stringify({ 
        coin,
       }),
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': secret
      }
    });
    let parsedCoinResp = await coinResp.json();

    while(!parsedCoinResp.confirmed) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      coinResp = await fetch(`${API_BASE}/coin-confirmed`, {
        method: 'POST',
        body: JSON.stringify({ 
          coin,
         }),
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': secret
        }
      });
      parsedCoinResp = await coinResp.json();
    }

    setMintStatus('tx confirmed!');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    setDataStoreInfoWithPersistence(new_info);
    await fetchServerInfo();
  };

  const syncDataStore = async () => {
    const resp = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      body: JSON.stringify({ 
        info: dataStoreInfo,
       }),
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': secret
      }
    });

    const {info: new_info} = await resp.json();
    setDataStoreInfoWithPersistence(new_info);
  }

  const buildAndSubmitTx = async () => {
    setTxStatus('building tx...');

    let resp;
    let sig: any = undefined;
    if(spendAction === 'update_metadata') {
      resp = await fetch(`${API_BASE}/update-metadata`, {
        method: 'POST',
        body: JSON.stringify({
          info: dataStoreInfo,
          new_root_hash: newRootHash,
          new_label: newLabel,
          new_description: newDescription,
          owner_public_key: spendAsOption === 'owner' ? userPublicKey : undefined,
          admin_public_key: spendAsOption === 'admin' ? serverInfo.pk : undefined,
          writer_public_key: spendAsOption === 'writer' ? serverInfo.pk : undefined,
         }),
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': secret
        }
      });
      resp = await resp.json();
    } else if(spendAction === 'update_ownership') {
      resp = await fetch(`${API_BASE}/update-ownership`, {
        method: 'POST',
        body: JSON.stringify({
          info: dataStoreInfo,
          new_owner_puzzle_hash: dataStoreInfo.owner_puzzle_hash,
          new_delegated_puzzle_keys_and_types: newDelegatedPuzzlesInfos,
          owner_public_key: spendAsOption === 'owner' ? userPublicKey : undefined,
          admin_public_key: spendAsOption === 'admin' ? serverInfo.pk : undefined,
         }),
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': secret
        }
      });
      resp = await resp.json();
    } else if(spendAction === 'oracle') {
      resp = await fetch(`${API_BASE}/oracle`, {
        method: 'POST',
        body: JSON.stringify({
          info: dataStoreInfo,
          fee: 500000000,
         }),
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': secret
        }
      });
      resp = await resp.json();
    } else {
      resp = await fetch(`${API_BASE}/melt`, {
        method: 'POST',
        body: JSON.stringify({
          info: dataStoreInfo,
          owner_public_key: userPublicKey,
         }),
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': secret
        }
      });
      resp = await resp.json();
    }

    if(spendAsOption === 'owner') {
      setTxStatus('waiting for Goby signature...');
      console.log({ resp })
      sig = await (window as any).chia.request({ method: 'signCoinSpends', params: { coinSpends: resp.coin_spends } });
      console.log({ sig })
    }

    let resp2: any = { coin_spends: [] };

    if(spendAction !== 'oracle') {
    setTxStatus('tx built, adding fee...');
      resp2 = await fetch(`${API_BASE}/add-fee`, {
        method: 'POST',
        body: JSON.stringify({
          fee: 500000000,
          coins: resp.coin_spends.map((cs: any) => cs.coin)
        }),
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': secret
        }
      });
      resp2 = await resp2.json();
    }

    const coin_spends = [...resp.coin_spends, ...resp2.coin_spends];
    console.log({ coin_spends })
    
    setTxStatus('broadcasting tx...');
    const { new_info } = await resp;
    const sendResp = await fetch(`${API_BASE}/sing-and-send`, {
      method: 'POST',
      body: JSON.stringify({ 
        coin_spends,
        signature: sig
       }),
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': secret
      }
    });
    const { err } = await sendResp.json();
    if(err) {
      alert('error when sending tx: ' + err)
      setTxStatus('error sending tx');
      return;
    }
    
    setTxStatus('waiting for tx confirmation...');

    const coin = coin_spends[coin_spends.length - 1].coin;
    let coinResp = await fetch(`${API_BASE}/coin-confirmed`, {
      method: 'POST',
      body: JSON.stringify({ 
        coin,
       }),
      headers: {
        'Content-Type': 'application/json',
        'X-Secret': secret
      }
    });
    let parsedCoinResp = await coinResp.json();

    while(!parsedCoinResp.confirmed) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      coinResp = await fetch(`${API_BASE}/coin-confirmed`, {
        method: 'POST',
        body: JSON.stringify({ 
          coin,
         }),
        headers: {
          'Content-Type': 'application/json',
          'X-Secret': secret
        }
      });
      parsedCoinResp = await coinResp.json();
    }

    setTxStatus('tx confirmed!');
    alert('tx confirmed!');

    if(spendAction !== 'burn') {
      setDataStoreInfoWithPersistence(new_info);
    } else {
      console.log({ dataStoreInfo });
      alert('data store melted')
      setDataStoreInfoWithPersistence(null);
    }
    await fetchServerInfo();
    setTxStatus(TX_PRESS_BUTTON);
  }

  console.log({ dataStoreInfo })

  return (
    <div>
      <div className="container mx-auto p-4 mb-4">
        <div className="bg-white shadow-md rounded p-6">
          <div className="flex w-full justify-between">
            <h2 className="text-2xl font-bold mb-4">Server Info</h2>
            <button onClick={() => fetchServerInfo()}>Refresh</button>
          </div>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            <code className="text-sm text-gray-800">
              { JSON.stringify(serverInfo, null, 2) }
            </code>
          </pre>
        </div>
      </div>
      <div className="container mx-auto p-4 mb-4">
        <div className="bg-white shadow-md rounded p-6">
          <div className="flex w-full justify-between">
            <h2 className="text-2xl font-bold mb-4">DataStore Info</h2>
            {dataStoreInfo !== 'loading' && dataStoreInfo !== null && (<button onClick={() => syncDataStore()}>Sync</button>)}
          </div>
          { dataStoreInfo ? (
            <pre className="bg-gray-100 p-4 rounded overflow-auto">
              <code className="text-sm text-gray-800">
                { JSON.stringify(dataStoreInfo, null, 2) }
              </code>
            </pre>
          ) : (
            <div className="flex flex-col">
              <p>No data store info found in local storage. Click the button below to launch a new data store.</p>
              <p className="pt-4 text-center">Mint status: {mintStatus}</p>
              <button
                className={'mt-4 rounded-lg px-4 py-2 mx-auto ' + (mintStatus !== 'press button to mint' ? 'text-white bg-gray-300' : 'text-white hover:opacity-80 bg-green-500')}
                onClick={() => launchDataStore()}
                disabled={mintStatus !== 'press button to mint'}  
              >Mint Data Store</button>
            </div>
          )}
        </div>
      </div>
      {dataStoreInfo !== 'loading' && dataStoreInfo && <div className="container mx-auto p-4 mb-4">
        <div className="bg-white shadow-md rounded p-6">
          <h2 className="text-2xl font-bold mb-4">Spend DataStore</h2>
          <div className="flex flex-col">
            <div>
              <label htmlFor="role" className="mb-2">
                Spend as
              </label>
              <select
                id="role"
                value={spendAsOption}
                onChange={(t) => {
                  const spendAs = t.target.value as "owner" | "admin" | "writer" | "oracle";
                  if(spendAs === 'oracle') {
                    setSpendAction('oracle');
                  } else {
                    setSpendAction('update_metadata');
                  }
                  setSpendAsOption(spendAs);
                }}
                className="ml-2 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-indigo-200"
              >
                <option value="admin">Admin (server)</option>
                <option value="writer">Writer (server)</option>
                <option value="oracle">Oracle (server)</option>
                <option value="owner">Owner (via Goby; server pays tx fees)</option>
              </select>
            </div>
            <div className="py-4">
              <label htmlFor="role" className="mb-2">
                Action:
              </label>
              <select
                id="role"
                value={spendAction}
                onChange={(t) => setSpendAction(t.target.value as "oracle" | "update_metadata" | "update_ownership")}
                className="ml-2 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-indigo-200"
              >
                {spendAsOption === 'oracle' && <option value="oracle">Oracle</option>}
                {spendAsOption !== 'oracle' && <option value="update_metadata">Update metadata</option>}
                {spendAsOption !== 'oracle' && spendAsOption !== 'writer' && <option value="update_ownership">Update ownership</option>}
                {spendAsOption === 'owner' && <option value="brun">Burn</option>}
              </select>
            </div>
            {spendAction === 'update_metadata' && <div className="pb-4">
              <div>
                <label htmlFor="newRootHash" className="block text-sm font-medium text-gray-700">
                  New Root Hash
                </label>
                <input
                  type="text"
                  value={newRootHash}
                  onChange={(t) => setNewRootHash(t.target.value)}
                  className="mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-indigo-200 w-full"
                />
              </div>
              <div>
                <label htmlFor="newLabel" className="block text-sm font-medium text-gray-700">
                  New Label
                </label>
                <input
                  type="text"
                  value={newLabel}
                  onChange={(t) => setNewLabel(t.target.value)}
                  className="mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-indigo-200 w-full"
                />
              </div>
              <div>
                <label htmlFor="newDescription" className="block text-sm font-medium text-gray-700">
                  New Description
                </label>
                <input
                  type="text"
                  value={newDescription}
                  onChange={(t) => setNewDescription(t.target.value)}
                  className="mt-1 p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring focus:ring-indigo-200 w-full"
                />
              </div>
            </div>}
            {spendAction === 'update_ownership' && <div className="pb-4">
                <div>
                  <div>New store will have the following layers:</div>
                  {newDelegatedPuzzlesInfos.map(dpi => (
                    <div key={dpi.type} className="flex ml-4">
                      <span className="pr-4 break-words">{dpi.type}</span>
                      <button
                        className="text-red-500 hover:underline"
                        onClick={() => {
                          setNewDelegatedPuzzleInfos(newDelegatedPuzzlesInfos.filter(d => d !== dpi));
                        }}
                      >Remove</button>
                    </div>
                  ))}
              </div>
            </div>}
            <p className="text-center">Status: {txStatus}</p>
            <button
              className={"px-4 py-2 rounded-lg mx-auto mt-4 " + (txStatus !== TX_PRESS_BUTTON ? 'text-white bg-gray-300' : 'text-white hover:opacity-80 bg-green-500')}
              disabled={txStatus !== TX_PRESS_BUTTON}
              onClick={() => buildAndSubmitTx()}
            >Push Tx</button>
          </div>
        </div>
      </div>}
    </div>
  );
}
