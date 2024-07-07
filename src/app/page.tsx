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

  useEffect(() => {
    if(dataStoreInfo === 'loading') {
      setDataStoreInfo(null); // todo: fetch from launcher
    }
  }, [dataStoreInfo, setDataStoreInfo]);

  if(loading) {
    return (
      <>Loading data...</>
    );
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
            <h2 className="text-2xl font-bold mb-4">DataStroe Info</h2>
            {dataStoreInfo !== 'loading' && dataStoreInfo !== null && (<button onClick={() => alert('todo')}>Sync</button>)}
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
              <button className='mt-4 bg-green-500 rounded-lg px-4 py-2 text-white hover:opacity-80 mx-auto' onClick={() => alert('todo')}>Launch Data Store</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
