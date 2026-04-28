import asyncio
import json
import inspect
import websockets
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

try:
    import opencc
    _converter = opencc.OpenCC("s2twp")  # 簡體 → 臺灣繁體
    def to_traditional(text: str) -> str:
        return _converter.convert(text)
except ImportError:
    def to_traditional(text: str) -> str:
        return text  # opencc 未安裝時直接回傳原文

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DEEPGRAM_API_KEY = "86ea6356170653e13a993f5c27ea0892938ca8aa"

DEEPGRAM_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?language=zh-TW"
    "&model=nova-2"
    "&punctuate=true"
    "&smart_format=true"
    "&channels=1"
    "&interim_results=true"
    "&endpointing=300"
)

KEEPALIVE_INTERVAL_SEC = 5


def _connect_kwargs(headers: dict) -> dict:
    sig = inspect.signature(websockets.connect)
    if "additional_headers" in sig.parameters:
        return {"additional_headers": headers}
    if "extra_headers" in sig.parameters:
        return {"extra_headers": headers}
    return {}


@app.websocket("/ws/transcribe")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    print("祈禱者已連線")

    stop_event = asyncio.Event()

    headers = {
        "Authorization": f"Token {DEEPGRAM_API_KEY}",
    }

    try:
        async with websockets.connect(
            DEEPGRAM_URL,
            **_connect_kwargs(headers),
        ) as dg_ws:
            print("Deepgram 連線成功")

            async def forward_audio():
                try:
                    while True:
                        data = await websocket.receive_bytes()
                        print(f"[音訊] {len(data)} bytes")
                        await dg_ws.send(data)
                except WebSocketDisconnect:
                    print("前端已斷線")
                    stop_event.set()
                except Exception as e:
                    print(f"音訊轉發錯誤: {e}")
                    stop_event.set()
                finally:
                    try:
                        await dg_ws.send('{"type":"CloseStream"}')
                    except Exception:
                        pass

            async def keepalive():
                try:
                    while not stop_event.is_set():
                        await asyncio.sleep(KEEPALIVE_INTERVAL_SEC)
                        if stop_event.is_set():
                            break
                        await dg_ws.send('{"type":"KeepAlive"}')
                except Exception as e:
                    print(f"KeepAlive 錯誤: {e}")

            async def receive_transcript():
                try:
                    async for message in dg_ws:
                        result = json.loads(message)
                        msg_type = result.get("type")

                        if msg_type != "Results":
                            print(f"[DG] type={msg_type}")
                            continue

                        alt = result.get("channel", {}).get("alternatives", [{}])[0]
                        transcript = alt.get("transcript", "").strip()
                        confidence = alt.get("confidence", 0)
                        is_final = bool(result.get("is_final", False))

                        # 簡繁轉換（opencc 保險層）
                        transcript = to_traditional(transcript)

                        print(f"[DG] conf={confidence:.2f} final={is_final} text='{transcript}'")

                        if not transcript:
                            continue

                        payload = {
                            "type": "transcript",
                            "transcript": transcript,
                            "is_final": is_final,
                            "speech_final": bool(result.get("speech_final", False)),
                        }
                        await websocket.send_text(json.dumps(payload, ensure_ascii=False))

                except Exception as e:
                    print(f"接收 Deepgram 結果錯誤: {e}")
                    stop_event.set()

            await asyncio.gather(forward_audio(), keepalive(), receive_transcript())

    except Exception as e:
        print(f"連線錯誤: {e}")
    finally:
        print("連線已關閉")