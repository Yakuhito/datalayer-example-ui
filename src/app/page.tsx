"use client";

import { useEffect, useState } from "react";
import { API_BASE, NETWORK_PREFIX } from "./config";
import { bech32m } from "bech32";

interface Window {
  ethereum: any;
}

export default function Home() {
  const [gobyInstalled, setGobyInstalled] = useState<boolean | null>(null);
  const [address, setAddress] = useState<string>('');

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
      console.log({ address })
      setAddress(address);
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
  });

  if(gobyInstalled === null) {
    return <></>;
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-xl font-medium mb-8">DataLayer Test App</h1>

      {!gobyInstalled ?
        <p>please use a browser with Goby installed</p> :
        (!address ? <button onClick={connectGoby} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:opacity-80">Connect Goby</button> : <p className="pb-8">Goby Address: {address}</p>)
      }

      {address && <MainComponent address={address}/>}
    </main>
  );
}

function MainComponent({ address }: { address: string }) {
  const [serverInfo, setServerInfo] = useState<any>(null);
  const [dataStoreInfo, setDataStoreInfo] = useState<'loading' | null | any>('loading');
  const [mintStatus, setMintStatus] = useState('press button to mint');
  const loading = serverInfo === null || dataStoreInfo === 'loading';

  const fetchServerInfo = async () => {
    const res = await fetch(`${API_BASE}/info`)

    setServerInfo(await res.json());
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
  };

  useEffect(() => {
    if(dataStoreInfo === 'loading') {
      const info = localStorage.getItem(DATASTORE_INFO_KEY);
      if(info) {
        setDataStoreInfo(JSON.parse(info));
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
        label: "Test DS",
        description: "A freshly-minted datastore",
        owner_address: address,
        fee: 50000000,
        oracle_fee: 1337
       }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    setMintStatus('broadcasting mint tx...');
    const { new_info, coin_spends } = await resp.json();
    await fetch(`${API_BASE}/sing_and_send`, {
      method: 'POST',
      body: JSON.stringify({ 
        coin_spends
       }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    setMintStatus('waiting for mint tx to be confirmed...');

    const coin = coin_spends[coin_spends.length - 1].coin;
    let coinResp = await fetch(`${API_BASE}/coin_confirmed`, {
      method: 'POST',
      body: JSON.stringify({ 
        coin,
       }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    let parsedCoinResp = await coinResp.json();

    while(!parsedCoinResp.confirmed) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      coinResp = await fetch(`${API_BASE}/coin_confirmed`, {
        method: 'POST',
        body: JSON.stringify({ 
          coin,
         }),
        headers: {
          'Content-Type': 'application/json'
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
        'Content-Type': 'application/json'
      }
    });

    const {info: new_info} = await resp.json();
    setDataStoreInfoWithPersistence(new_info);
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
                className='mt-4 bg-green-500 rounded-lg px-4 py-2 text-white hover:opacity-80 mx-auto'
                onClick={() => launchDataStore()}
                disabled={mintStatus !== 'press button to mint'}  
              >Mint Data Store</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
