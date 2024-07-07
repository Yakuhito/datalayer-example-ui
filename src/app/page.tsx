"use client";

import { useEffect, useState } from "react";
import { NETWORK_PREFIX } from "./config";
import { bech32m } from "bech32";

export default function Home() {
  const chia = (window as any).chia;
  const gobyInstalled = chia && chia.isGoby;
  const [address, setAddress] = useState<string>('');

  useEffect(() => {
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
  }, [gobyInstalled]);

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

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <h1 className="text-xl font-medium mb-8">DataLayer Test App</h1>

      {!gobyInstalled ?
        <p>please use a browser with Goby installed</p> :
        (!address ? <button onClick={connectGoby} className="bg-gray-400 px-4 py-2 rounded-lg">Connect Goby</button> : <p className="pb-8">Goby Address: {address}</p>)
      }

      {address && <MainComponent address={address}/>}
    </main>
  );
}

function MainComponent({ address }: { address: string }) {
  return (
    <>Yup, Goby is connected!</>
  );
}
