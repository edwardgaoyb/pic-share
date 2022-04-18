import 'react-bulma-components/dist/react-bulma-components.min.css';
import "./components/EmptyPlaceholder.css"
import { Button, Container, Columns, Navbar, Modal, Image } from 'react-bulma-components/dist';
import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import Peer from "peerjs";
import UserInfo from "./components/UserInfo";
// import ShareRequest from "./components/ShareRequest";
// import ImageUploader from "./components/ImageUploader";
// import EmptyPlaceholder from "./components/EmptyPlaceholder";
// import Loader from "./components/Loader";
import PartitionList from './components/PartitionList';
import logo from './logo.png'

function App() {
    const socket = useRef();
    const peerInstances = useRef({});
    const usernameHolder = useRef();
    // const [requested, setRequested] = useState(false);
    // const [sentRequest, setSentRequest] = useState(false);
    // const [sending, setSending] = useState(false);
    // const [receiving, setReceiving] = useState(false);
    // const [rejected, setRejected] = useState(false);
    // const [loading, setLoading] = useState(false);
    const [myUsername, setMyUsername] = useState("");
    const [usersList, setUsersList] = useState([]);
    // const [peerUsername, setPeerUsername] = useState("");
    // const [peerSignal, setPeerSignal] = useState("");
    const expectedPartitionIds = useRef([]);
    const receivedPartitions = useRef({}); // {'00': <binary data for large00>, '01': <binary data of large01>, ...}}
    const SOCKET_EVENT = {
        CONNECTED: "connected",
        DISCONNECTED: "disconnect",
        USERS_LIST: "users_list",
        REQUEST_SENT: "request_sent",
        REQUEST_ACCEPTED: "request_accepted",
        REQUEST_REJECTED: "request_rejected",
        SEND_REQUEST: "send_request",
        ACCEPT_REQUEST: "accept_request",
        REJECT_REQUEST: "reject_request",
        // Distrubuted sharing
        REGISTER_PARTITIONS: "register_partitions",
        REQUEST_PARTITION: "request_partition",
        DOWNLOAD_REQUESTED: "download_requested",
    };

    const acceptRequest = (senderUsername, senderSignal, partition) => {
        var currUN = usernameHolder.current;
        console.log(`creating new Peer in acceptRequest(): ${currUN}_${partition}`)
        const peer = new Peer(`${currUN}_${partition}`, {
            host: 'localhost',
            port: 9000,
            path: '/myapp'
        });
        peer.on('connection', function (conn) {
            conn.on('data', data => {
                console.log(`Finished receiving partition: ${partition}`)
                // Once, all the chunks are received, combine them to form a Blob
                receivedPartitions.current[partition] = data;
                var keys = Object.keys(receivedPartitions.current);
                console.log('allPartitions: ', receivedPartitions.current);
                console.log('expectedPartitionIds: ', expectedPartitionIds.current);
                if (keys.length === expectedPartitionIds.current.length) {
                    console.log('---> merging all partitions into one file')
                    var mergedPartitions = [];
                    for (const partitionId of expectedPartitionIds.current) {
                        console.log('partitionId: ', partitionId);
                        mergedPartitions = [...mergedPartitions, receivedPartitions.current[partitionId]];
                    }
                    console.log('allChunks: ', mergedPartitions);
                    const file = new Blob(mergedPartitions);
                    setReceivedFilePreview(URL.createObjectURL(file));
                }
                else {
                    console.log('More partitions to download');
                }
            });
        });
        socket.current.emit(SOCKET_EVENT.ACCEPT_REQUEST, { src: currUN, to: senderUsername, partition: partition });
    };

    const sendFile = (username, partition) => {
        const peer = peerInstances.current[partition]
        console.log(`sendFile() -> connecting to ${username}_${partition}`)
        var conn = peer.connect(`${username}_${partition}`);
        conn.on('open', async function () {
            const path = `/sample_data/largepic${partition}`
            let file = new File([await (await fetch(path)).blob()], path);
            let buffer = await file.arrayBuffer();
            conn.send(buffer, true);
        });
    }

    const sendRequest = (username, partition, src) => {
        var currUN = usernameHolder.current;
        console.log(`creating new peer in sendRequest(): ${currUN}_${partition}`)
        const peer = new Peer(`${currUN}_${partition}`, {
            host: 'localhost',
            port: 9000,
            path: '/myapp'
        });
        peerInstances.current[partition] = peer;
        socket.current.emit(SOCKET_EVENT.SEND_REQUEST, {
            to: username,
            signal: null,
            username: src,
            partition: partition,
        });

    };

    const downloadPartitions = () => {
        console.log('(downloadPartitions) userList: ', usersList);
        console.log('myUsername: ', myUsername);
        usersList.forEach(u => {
            var partitions = u.partitions;
            if (partitions) {
                console.debug('u: ', u);
                console.debug('partitions:', partitions)
                expectedPartitionIds.current = [...expectedPartitionIds.current, ...partitions];
                //remove duplicate
                expectedPartitionIds.current = [...new Set(expectedPartitionIds.current)];
                for (const partition of partitions) {
                    const filename = `large${partition}`;
                    console.log(`Start downloading ${filename}...`);
                    socket.current.emit(SOCKET_EVENT.REQUEST_PARTITION, { from: myUsername, to: u.username, partition: partition })
                }
            }
        })
        expectedPartitionIds.current.sort();
    }

    const SERVER_URL = "ws://localhost:7000/";
    const partitionList = process.env.REACT_APP_PARTITION_LIST;
    console.log('partitionList: ', partitionList);
    useEffect(() => {
        socket.current = io.connect(SERVER_URL);

        socket.current.on(SOCKET_EVENT.CONNECTED, (username) => {
            setMyUsername(username)
            usernameHolder.current = username;
            if (partitionList) {
                // register available partitions
                console.log('partition list found on this node: ', partitionList);
                console.log('registering local partitions on signaling server')
                var partitions = partitionList.split(',');
                socket.current.emit(SOCKET_EVENT.REGISTER_PARTITIONS, {
                    from: username,
                    partitions: partitions,
                })
            } else {
                //request the list of partitions
                console.log('no partition found on this node, requesting partitions from signaling server')
            }
        });

        socket.current.on(SOCKET_EVENT.USERS_LIST, (users) => {
            setUsersList(users)
        });

        socket.current.on(SOCKET_EVENT.REQUEST_SENT, ({ signal, username, partition }) => {
            acceptRequest(username, signal, partition);
        });

        socket.current.on(SOCKET_EVENT.REQUEST_ACCEPTED, ({ src, partition }) => {
            console.log('SOCKET_EVENT.REQUEST_ACCEPTED')
            console.log('src: ', src);
            console.log('partition: ', partition);
            sendFile(src, partition)
        });

        socket.current.on(SOCKET_EVENT.DOWNLOAD_REQUESTED, ({ from, partition, to }) => {
            console.log('SOCKET_EVENT.DOWNLOAD_REQUESTED, to: ', to);
            console.log('SOCKET_EVENT.DOWNLOAD_REQUESTED, from: ', from);
            sendRequest(from, partition, to);
        })
    }, []);
    // const [file, setFile] = useState(null);
    const [receivedFilePreview, setReceivedFilePreview] = useState("");
    // useEffect(() => () => {
    //     // Make sure to revoke the data uris to avoid memory leaks
    //     console.log('destruting filePreview...')
    //     URL.revokeObjectURL(receivedFilePreview)
    // }, [receivedFilePreview]);

    return (
        <React.Fragment>
            <Navbar
                fixed="top"
                active={false}
                transparent
            >
                <Navbar.Brand>
                    <Navbar.Item renderAs="a" href="#">
                        <img src={logo}
                            alt="Pic Share" />
                    </Navbar.Item>
                    <Navbar.Burger />
                </Navbar.Brand>
            </Navbar>
            <Modal show={receivedFilePreview !== ""}
                onClose={() => {
                    setReceivedFilePreview("");
                }}>
                <Modal.Content>
                    <React.Fragment>
                        <div>Preview of downloaded file</div>
                        <Image src={receivedFilePreview} />
                    </React.Fragment>
                </Modal.Content>
            </Modal>
            <Container fluid>
                <Columns>
                    <Columns.Column size="three-fifths">
                        <UserInfo myUsername={myUsername}
                            subtext="Share your username with others so they can send you a picture"
                            color="#EFFFFF"
                        />
                        {/* <ImageUploader setFile={setFile}/> */}
                        <PartitionList partitionList={process.env.REACT_APP_PARTITION_LIST} usersList={usersList} />
                        {(partitionList === undefined || partitionList === '') && <Button
                            color="success"
                            renderAs="span"
                            onClick={downloadPartitions}
                        >
                            Download partitions
                        </Button>}
                    </Columns.Column>
                    <Columns.Column>
                        {/* {usersList.length > 1 ? usersList.map(({ username, timestamp }) => username !== myUsername &&
                            <UserInfo key={username} myUsername={username} timestamp={timestamp}
                                sendRequest={sendRequest} disabled={!file || loading} />
                        ) :
                            <EmptyPlaceholder title="No Users Online Right Now!"
                                subtitle="Wait till someone connects to start sharing"
                                image="data:image/png;base64,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" />
                        } */}
                    </Columns.Column>
                </Columns>
            </Container>

        </React.Fragment>
    );
}

export default App;
