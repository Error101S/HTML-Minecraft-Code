import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, onValue, set, onDisconnect } from "firebase/database";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDXUEhCn_JnQ1sz4hvxflGu9ZlZ56Zebas",
  authDomain: "minecraft-hmtl-edition.firebaseapp.com",
  databaseURL: "https://minecraft-hmtl-edition-default-rtdb.firebaseio.com",
  projectId: "minecraft-hmtl-edition",
  storageBucket: "minecraft-hmtl-edition.firebasestorage.app",
  messagingSenderId: "996527981600",
  appId: "1:996527981600:web:4ad3927171aaeafee16845",
  measurementId: "G-DQJPSP102H"
};

const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);
const playersRef = ref(database, 'players');

type MovementKeys = {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
};

type BlockType = "grass" | "dirt" | "stone" | "oakLog" | "torch";

type BlockRecord = {
  type: BlockType;
  active: boolean;
  x: number;
  y: number;
  z: number;
};

type AimTarget = {
  type: BlockType;
  x: number;
  y: number;
  z: number;
  normal: THREE.Vector3;
};

type ChatMessage = {
  id: number;
  text: string;
  createdAt: number;
  tutorial?: boolean;
};

type Gamemode = "survival" | "creative" | "adventure" | "spectator";

const BLOCK_SIZE = 1;
const PLAYER_HEIGHT = 1.8;
const PLAYER_CROUCH_HEIGHT = 1.5;
const PLAYER_HALF_WIDTH = 0.3;
const PLAYER_EYE_HEIGHT = 1.62;
const CROUCH_EYE_HEIGHT = 1.27;
const MOVE_SPEED = 4.317;
const SPRINT_SPEED = 5.612;
const SNEAK_SPEED = 1.3;
const STOP_DECEL = 18;
const JUMP_SPEED = 8.2;
const GRAVITY = 24.5;
const TERMINAL_VELOCITY = -55;
const MOUSE_SENSITIVITY = 0.0022;
const TERRAIN_SIZE = 64;
const GROUND_Y = -1;
const EPSILON = 1e-4;
const PLACE_REPEAT_INTERVAL = 0.1;
const CREATIVE_BREAK_COOLDOWN = 0.1;
const DIRT_DEPTH = 3;
const STONE_DEPTH = 8;
const TREE_ATTEMPTS = 28;
const TREE_MIN_HEIGHT = 3;
const TREE_MAX_HEIGHT = 6;
const BLOCK_ACTIVATION_DISTANCE = 30;
const WORLD_STREAM_UPDATE_INTERVAL = 0.2;
const BLOCK_BREAK_STAGE_COUNT = 9;
const WORLD_TOP_Y = 48;
const TORCH_WIDTH = 2 / 16;
const TORCH_HEIGHT = 10 / 16;
const TORCH_CENTER_Y = TORCH_HEIGHT / 2;
const MUSIC_TRACK_URLS = [
  "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/menu1.ogg",
  "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/menu2.ogg",
  "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/menu3.ogg",
  "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/menu4.ogg",
];
const CHAT_FADE_MS = 5000;
const CHAT_MAX_MESSAGES = 30;

const TEXTURE_URLS = {
  dirt: "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/dirt_block.png",
  grassTop: "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/grass_block.png",
  grassSide: "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/grass_block_side.png",
  stone: "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/stone.png",
  oakLogSide: "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/log_oak.png",
  oakLogTop: "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/log_oak_top.png",
  torch: "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/torch_on.png",
  steve: "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/OGSteve.png",
};
const UI_TEXTURE_URLS = {
  hotbarSlot: "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/hotbar_0.png",
  hotbarSelected: "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/selected_hotbar_slot.png",
  hotbarEndCap: "https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/hotbar_end_cap.png",
};
const DESTROY_STAGE_URLS = Array.from(
  { length: BLOCK_BREAK_STAGE_COUNT },
  (_, index) => `https://raw.githubusercontent.com/Error101S/HTML-Minecraft/main/destroy_stage_${index}.png`
);
const HOTBAR_SLOTS: Array<BlockType | null> = ["grass", "dirt", "stone", "oakLog", "torch", null, null, null, null];

const blockKey = (x: number, y: number, z: number) => `${x},${y},${z}`;

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const selectedBlockTypeRef = useRef<BlockType | null>(HOTBAR_SLOTS[0]);
  const selectedHotbarIndexRef = useRef(0);
  const [isLocked, setIsLocked] = useState(false);
  const [selectedBlockType, setSelectedBlockType] = useState<BlockType | null>(HOTBAR_SLOTS[0]);
  const [selectedHotbarIndex, setSelectedHotbarIndex] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatOpenRef = useRef(false);
  const chatInputValueRef = useRef("");
  const chatMessageIdRef = useRef(0);
  const addChatMessageRef = useRef<(text: string) => void>(() => {});
  const runChatCommandRef = useRef<(value: string) => void>(() => {});
  const closeChatRef = useRef<() => void>(() => {});
  const showControlsRef = useRef(false);

  const [showDebug, setShowDebug] = useState(false);
  const [handPos, setHandPos] = useState({ x: 0.6, y: -0.5, z: -1.2 });
  const [handRot, setHandRot] = useState({ x: -62.6, y: 37.0, z: -34.5 });

  const flightEnabledRef = useRef(false);
  const flyingRef = useRef(false);
  const lastJumpTimeRef = useRef(0);
  const jumpCountRef = useRef(0);
  const shiftHeldRef = useRef(false);
  const sprintKeyHeldRef = useRef(false);

  const currentEyeHeightRef = useRef(PLAYER_EYE_HEIGHT);
  const currentFovRef = useRef(70);
  const playerHeightRef = useRef(PLAYER_HEIGHT);

  const gamemodeRef = useRef<Gamemode>("survival");
  const spectatorPositionRef = useRef(new THREE.Vector3());
  const spectatorYawRef = useRef(0);
  const spectatorPitchRef = useRef(0);
  const spectatorActiveRef = useRef(false);

  const spaceHoldTimerRef = useRef<number | null>(null);
  const creativeBreakCooldownRef = useRef(0);

  // Multiplayer state
  const localPlayerId = useRef<string>(crypto.randomUUID());
  const remotePlayers = useRef<Map<string, THREE.Group>>(new Map());
  const [playerCount, setPlayerCount] = useState(1);

  const copyHandConfig = () => {
    const config = `Position: X: ${handPos.x.toFixed(1)}, Y: ${handPos.y.toFixed(1)}, Z: ${handPos.z.toFixed(1)}\nRotation: X: ${handRot.x.toFixed(1)}°, Y: ${handRot.y.toFixed(1)}°, Z: ${handRot.z.toFixed(1)}°`;
    navigator.clipboard.writeText(config).then(() => {
      addChatMessageRef.current("Hand config copied to clipboard!");
    });
  };

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) {
      window.setTimeout(() => {
        chatInputRef.current?.focus();
        const input = chatInputRef.current;
        if (input) {
          const length = input.value.length;
          input.setSelectionRange(length, length);
        }
      }, 0);
    }
  }, [chatOpen]);

  useEffect(() => {
    chatInputValueRef.current = chatInput;
  }, [chatInput]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.Fog(0x87ceeb, 24, 220);

    const camera = new THREE.PerspectiveCamera(75, 1, 0.01, 2000);
    const playerFeet = new THREE.Vector3(0, 0, 6);
    camera.position.set(playerFeet.x, playerFeet.y + PLAYER_EYE_HEIGHT, playerFeet.z);

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setClearColor(0x87ceeb, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.display = "block";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.tabIndex = 0;
    renderer.domElement.style.outline = "none";
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(10, 20, 10);
    scene.add(sunLight);

    const addChatMessage = (text: string, tutorial = false) => {
      const id = chatMessageIdRef.current;
      chatMessageIdRef.current += 1;
      setChatMessages((current) => {
        const newMessage: ChatMessage = { id, text, createdAt: Date.now(), tutorial };
        const updated = [...current, newMessage];
        if (updated.length > CHAT_MAX_MESSAGES) {
          const nonTutorialIndex = updated.findIndex((msg) => !msg.tutorial);
          if (nonTutorialIndex !== -1) updated.splice(nonTutorialIndex, 1);
        }
        return updated;
      });
    };

    const runChatCommand = (value: string) => {
      const parts = value.trim().split(/\s+/);
      const cmd = parts[0]?.toLowerCase();
      const sub = parts[1]?.toLowerCase();

      if (cmd === "/gamemode") {
        if (!sub) return;
        const prevGamemode = gamemodeRef.current;

        if (sub === "c" || sub === "creative") {
          gamemodeRef.current = "creative";
          flightEnabledRef.current = true;
          flyingRef.current = false;
          velocity.set(0, 0, 0);
        } else if (sub === "s" || sub === "survival") {
          gamemodeRef.current = "survival";
          flightEnabledRef.current = false;
          flyingRef.current = false;
        } else if (sub === "adventure") {
          gamemodeRef.current = "adventure";
        } else if (sub === "spectator") {
          if (prevGamemode !== "spectator") {
            spectatorPositionRef.current.copy(playerFeet);
            spectatorYawRef.current = cameraState.yaw;
            spectatorPitchRef.current = cameraState.pitch;
          }
          gamemodeRef.current = "spectator";
          spectatorActiveRef.current = true;
          flightEnabledRef.current = false;
          flyingRef.current = false;
          velocity.set(0, 0, 0);
        }

        if (prevGamemode === "spectator" && gamemodeRef.current !== "spectator") {
          spectatorActiveRef.current = false;
          playerFeet.copy(spectatorPositionRef.current);
          cameraState.yaw = spectatorYawRef.current;
          cameraState.pitch = spectatorPitchRef.current;
          velocity.set(0, 0, 0);
        }
        return;
      }

      addChatMessage(`Unknown command: ${value}`);
    };

    const openChat = (initialValue: string) => {
      setChatOpen(true);
      setChatInput(initialValue);
    };

    const closeChat = () => {
      setChatOpen(false);
      setChatInput("");
    };

    addChatMessageRef.current = addChatMessage;
    runChatCommandRef.current = runChatCommand;
    closeChatRef.current = closeChat;

    if (!showControlsRef.current) {
      showControlsRef.current = true;
      window.setTimeout(() => {
        addChatMessage("=== Controls ===", true);
        addChatMessage("WASD: Move", true);
        addChatMessage("Space: Jump / Fly up", true);
        addChatMessage("Shift: Sneak (Crouch)", true);
        addChatMessage("Ctrl: Sprint", true);
        addChatMessage("F3: Toggle hand debug", true);
        addChatMessage("Left Click: Destroy blocks", true);
        addChatMessage("Right Click: Place blocks", true);
        addChatMessage("Scroll / 1-9: Change hotbar", true);
        addChatMessage("T: Open chat", true);
        addChatMessage("/ : Use commands", true);
        addChatMessage("Click to lock mouse", true);
        addChatMessage("Multiplayer: Other players will appear in real-time!", true);
      }, 100);
    }

    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin("anonymous");

    const prepareTexture = (texture: THREE.Texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      return texture;
    };

    const applyBoxFaceUv = (
      geometry: THREE.BoxGeometry,
      faceIndex: number,
      x: number,
      y: number,
      width: number,
      height: number,
      textureWidth = 16,
      textureHeight = 16
    ) => {
      const uvs = geometry.getAttribute("uv") as THREE.BufferAttribute;
      const start = faceIndex * 8;
      const minU = x / textureWidth;
      const maxU = (x + width) / textureWidth;
      const maxV = 1 - y / textureHeight;
      const minV = 1 - (y + height) / textureHeight;
      const values = [maxU, maxV, minU, maxV, maxU, minV, minU, minV];
      uvs.array.set(values, start);
      uvs.needsUpdate = true;
    };

    const createTorchGeometry = (outlinePadding = 0) => {
      const geometry = new THREE.BoxGeometry(
        TORCH_WIDTH + outlinePadding,
        TORCH_HEIGHT + outlinePadding,
        TORCH_WIDTH + outlinePadding
      );
      applyBoxFaceUv(geometry, 0, 9, 6, -2, 10);
      applyBoxFaceUv(geometry, 1, 9, 6, -2, 10);
      applyBoxFaceUv(geometry, 2, 7, 6, 2, 2);
      applyBoxFaceUv(geometry, 3, 7, 14, 2, 2);
      applyBoxFaceUv(geometry, 4, 9, 6, -2, 10);
      applyBoxFaceUv(geometry, 5, 9, 6, -2, 10);
      return geometry;
    };

    const applyDefaultVertexColors = (geometry: THREE.BufferGeometry, faceShades?: number[]) => {
      const position = geometry.getAttribute("position");
      const colors = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i += 1) {
        const faceIndex = Math.floor(i / 4);
        const shade = faceShades?.[faceIndex] ?? 1;
        colors[i * 3] = shade;
        colors[i * 3 + 1] = shade;
        colors[i * 3 + 2] = shade;
      }
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    };

    const textures = {
      dirt: prepareTexture(textureLoader.load(TEXTURE_URLS.dirt)),
      grassTop: prepareTexture(textureLoader.load(TEXTURE_URLS.grassTop)),
      grassSide: prepareTexture(textureLoader.load(TEXTURE_URLS.grassSide)),
      stone: prepareTexture(textureLoader.load(TEXTURE_URLS.stone)),
      oakLogSide: prepareTexture(textureLoader.load(TEXTURE_URLS.oakLogSide)),
      oakLogTop: prepareTexture(textureLoader.load(TEXTURE_URLS.oakLogTop)),
      torch: prepareTexture(textureLoader.load(TEXTURE_URLS.torch)),
      destroyStages: DESTROY_STAGE_URLS.map((url) => prepareTexture(textureLoader.load(url))),
    };

    const dirtMaterial = new THREE.MeshStandardMaterial({ map: textures.dirt, roughness: 1, metalness: 0, vertexColors: true });
    const grassTopMaterial = new THREE.MeshStandardMaterial({ map: textures.grassTop, roughness: 1, metalness: 0, vertexColors: true });
    const grassSideMaterial = new THREE.MeshStandardMaterial({ map: textures.grassSide, roughness: 1, metalness: 0, vertexColors: true });
    const stoneMaterial = new THREE.MeshStandardMaterial({ map: textures.stone, roughness: 1, metalness: 0, vertexColors: true });
    const oakLogSideMaterial = new THREE.MeshStandardMaterial({ map: textures.oakLogSide, roughness: 1, metalness: 0, vertexColors: true });
    const oakLogTopMaterial = new THREE.MeshStandardMaterial({ map: textures.oakLogTop, roughness: 1, metalness: 0, vertexColors: true });
    const torchMaterial = new THREE.MeshStandardMaterial({
      map: textures.torch,
      roughness: 1,
      metalness: 0,
      transparent: true,
      alphaTest: 0.1,
      vertexColors: true,
    });

    const grassMaterials = [
      grassSideMaterial, grassSideMaterial, grassTopMaterial,
      dirtMaterial, grassSideMaterial, grassSideMaterial,
    ] as THREE.Material[];
    const dirtMaterials = [dirtMaterial, dirtMaterial, dirtMaterial, dirtMaterial, dirtMaterial, dirtMaterial] as THREE.Material[];
    const stoneMaterials = [stoneMaterial, stoneMaterial, stoneMaterial, stoneMaterial, stoneMaterial, stoneMaterial] as THREE.Material[];
    const oakLogMaterials = [
      oakLogSideMaterial, oakLogSideMaterial,
      oakLogTopMaterial, oakLogTopMaterial,
      oakLogSideMaterial, oakLogSideMaterial,
    ] as THREE.Material[];

    const blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    const torchGeometry = createTorchGeometry();
    applyDefaultVertexColors(blockGeometry, [0.78, 0.78, 1, 0.52, 0.66, 0.66]);
    applyDefaultVertexColors(torchGeometry);
    const selectionGeometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(BLOCK_SIZE + 0.01, BLOCK_SIZE + 0.01, BLOCK_SIZE + 0.01));
    const torchSelectionGeometry = new THREE.EdgesGeometry(createTorchGeometry(0.01));
    const destroyOverlayGeometry = new THREE.BoxGeometry(BLOCK_SIZE + 0.02, BLOCK_SIZE + 0.02, BLOCK_SIZE + 0.02);
    const torchDestroyOverlayGeometry = createTorchGeometry(0.02);
    const selectionMaterial = new THREE.LineBasicMaterial({
      color: 0x111111, transparent: true, opacity: 0.95, depthTest: true, depthWrite: false,
    });
    const selectionOutline = new THREE.LineSegments(selectionGeometry, selectionMaterial);
    selectionOutline.visible = false;
    scene.add(selectionOutline);
    const destroyStageMaterials = textures.destroyStages.map((texture) => {
      const material = new THREE.MeshBasicMaterial({
        map: texture, transparent: true, opacity: 0.95, depthTest: true, depthWrite: false,
      });
      material.polygonOffset = true;
      material.polygonOffsetFactor = -2;
      material.polygonOffsetUnits = -2;
      return Array.from({ length: 6 }, () => material) as THREE.Material[];
    });
    const destroyOverlay = new THREE.Mesh(destroyOverlayGeometry, destroyStageMaterials[0]);
    destroyOverlay.visible = false;
    scene.add(destroyOverlay);

    const steveTexture = prepareTexture(textureLoader.load(TEXTURE_URLS.steve));
    
    const createHandModel = () => {
      const handGroup = new THREE.Group();
      const pixelScale = 1/16;

      const cube1Geo = new THREE.BoxGeometry(4 * pixelScale, 12 * pixelScale, 4 * pixelScale);
      const cube1Mat = new THREE.MeshStandardMaterial({
        map: steveTexture,
        roughness: 1,
        metalness: 0,
      });
      const cube1 = new THREE.Mesh(cube1Geo, cube1Mat);
      cube1.position.set(
        (-8 + 4/2) * pixelScale,
        (12 + 12/2) * pixelScale,
        (-2 + 4/2) * pixelScale
      );
      
      const uvs1 = cube1Geo.getAttribute("uv") as THREE.BufferAttribute;
      for (let face = 0; face < 6; face++) {
        const u1 = 40 / 64;
        const u2 = (40 + 4) / 64;
        const v2 = 1 - (16 / 64);
        const v1 = 1 - ((16 + 12) / 64);
        
        const idx = face * 8;
        uvs1.array[idx] = u2; uvs1.array[idx + 1] = v1;
        uvs1.array[idx + 2] = u1; uvs1.array[idx + 3] = v1;
        uvs1.array[idx + 4] = u2; uvs1.array[idx + 5] = v2;
        uvs1.array[idx + 6] = u1; uvs1.array[idx + 7] = v2;
      }
      uvs1.needsUpdate = true;
      handGroup.add(cube1);

      const cube2Geo = new THREE.BoxGeometry(4 * pixelScale, 12 * pixelScale, 4 * pixelScale);
      const cube2Mat = new THREE.MeshStandardMaterial({
        map: steveTexture,
        roughness: 1,
        metalness: 0,
      });
      const cube2 = new THREE.Mesh(cube2Geo, cube2Mat);
      cube2.position.set(
        (4 + 4/2) * pixelScale,
        (12 + 12/2) * pixelScale,
        (-2 + 4/2) * pixelScale
      );
      
      const uvs2 = cube2Geo.getAttribute("uv") as THREE.BufferAttribute;
      for (let face = 0; face < 6; face++) {
        const u1 = 32 / 64;
        const u2 = (32 + 4) / 64;
        const v2 = 1 - (48 / 64);
        const v1 = 1 - ((48 + 12) / 64);
        
        const idx = face * 8;
        uvs2.array[idx] = u2; uvs2.array[idx + 1] = v1;
        uvs2.array[idx + 2] = u1; uvs2.array[idx + 3] = v1;
        uvs2.array[idx + 4] = u2; uvs2.array[idx + 5] = v2;
        uvs2.array[idx + 6] = u1; uvs2.array[idx + 7] = v2;
      }
      uvs2.needsUpdate = true;
      handGroup.add(cube2);

      return handGroup;
    };

    const handModel = createHandModel();
    handModel.position.set(handPos.x, handPos.y, handPos.z);
    handModel.rotation.set(
      THREE.MathUtils.degToRad(handRot.x),
      THREE.MathUtils.degToRad(handRot.y),
      THREE.MathUtils.degToRad(handRot.z)
    );
    camera.add(handModel);

    const blockRecords = new Map<string, BlockRecord>();
    const terrainStart = -TERRAIN_SIZE / 2;
    const hasBlockAt = (x: number, y: number, z: number) => blockRecords.has(blockKey(x, y, z));
    const blockCenter = new THREE.Vector3();
    const instanceColor = new THREE.Color();
    const activationDistanceSq = BLOCK_ACTIVATION_DISTANCE * BLOCK_ACTIVATION_DISTANCE;
    const instanceMatrix = new THREE.Matrix4();
    const instancedMeshes = new Map<BlockType, THREE.InstancedMesh>();
    const instancedLookup = new Map<BlockType, BlockRecord[]>();
    const blockTypes: BlockType[] = ["grass", "dirt", "stone", "oakLog", "torch"];

    const getBlockMaterials = (type: BlockType) => {
      switch (type) {
        case "grass": return grassMaterials;
        case "stone": return stoneMaterials;
        case "oakLog": return oakLogMaterials;
        case "torch": return torchMaterial;
        default: return dirtMaterials;
      }
    };

    const getBlockGeometry = (type: BlockType) => (type === "torch" ? torchGeometry : blockGeometry);

    const addBlock = (x: number, y: number, z: number, type: BlockType) => {
      const key = blockKey(x, y, z);
      if (blockRecords.has(key)) return false;
      blockRecords.set(key, { type, active: false, x, y, z });
      return true;
    };

    const removeBlock = (x: number, y: number, z: number) => {
      const key = blockKey(x, y, z);
      if (!blockRecords.has(key)) return false;
      blockRecords.delete(key);
      return true;
    };

    const removeUnsupportedTorches = (x: number, y: number, z: number) => {
      const torchAbove = blockRecords.get(blockKey(x, y + 1, z));
      if (torchAbove?.type === "torch" && !isSolidBlock(x, y, z)) {
        blockRecords.delete(blockKey(x, y + 1, z));
        return true;
      }
      return false;
    };

    const blocksFaceAt = (x: number, y: number, z: number) => {
      const record = blockRecords.get(blockKey(x, y, z));
      return !!record && record.type !== "torch";
    };

    const isBlockExposed = (x: number, y: number, z: number) => {
      const record = blockRecords.get(blockKey(x, y, z));
      if (record?.type === "torch") return true;
      return (
        !blocksFaceAt(x + 1, y, z) ||
        !blocksFaceAt(x - 1, y, z) ||
        !blocksFaceAt(x, y + 1, z) ||
        !blocksFaceAt(x, y - 1, z) ||
        !blocksFaceAt(x, y, z + 1) ||
        !blocksFaceAt(x, y, z - 1)
      );
    };

    const isBlockWithinActivationRange = (record: BlockRecord) => {
      blockCenter.set(record.x + 0.5, record.y + (record.type === "torch" ? TORCH_CENTER_Y : 0.5), record.z + 0.5);
      return camera.position.distanceToSquared(blockCenter) <= activationDistanceSq;
    };

    const getBlockBreakDuration = (type: BlockType): number => {
      if (gamemodeRef.current === "creative") return 0;
      switch (type) {
        case "dirt": return 0.75;
        case "grass": return 0.9;
        case "stone": return 7.5;
        case "oakLog": return 0.7;
        case "torch": return 0;
        default: return 0.75;
      }
    };

    const rebuildInstancedMeshes = () => {
      for (const mesh of instancedMeshes.values()) scene.remove(mesh);
      instancedMeshes.clear();
      instancedLookup.clear();

      for (const type of blockTypes) {
        const activeRecords = Array.from(blockRecords.values()).filter(r => r.type === type && r.active);
        if (activeRecords.length === 0) continue;
        const mesh = new THREE.InstancedMesh(getBlockGeometry(type), getBlockMaterials(type), activeRecords.length);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.frustumCulled = false;
        mesh.userData = { blockType: type };
        for (let i = 0; i < activeRecords.length; i++) {
          const record = activeRecords[i];
          instanceMatrix.makeTranslation(record.x + 0.5, record.y + (record.type === "torch" ? TORCH_CENTER_Y : 0.5), record.z + 0.5);
          mesh.setMatrixAt(i, instanceMatrix);
          instanceColor.setRGB(1, 1, 1);
          mesh.setColorAt(i, instanceColor);
        }
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        instancedMeshes.set(type, mesh);
        instancedLookup.set(type, activeRecords);
        scene.add(mesh);
      }
    };

    const refreshActiveBlocks = (force = false) => {
      let changed = false;
      for (const record of blockRecords.values()) {
        const next = isBlockExposed(record.x, record.y, record.z) && isBlockWithinActivationRange(record);
        if (record.active !== next) { record.active = next; changed = true; }
      }
      if (changed || force) rebuildInstancedMeshes();
    };

    const isWithinTerrain = (x: number, z: number) =>
      x >= terrainStart && x < terrainStart + TERRAIN_SIZE && z >= terrainStart && z < terrainStart + TERRAIN_SIZE;

    const generateTerrainColumn = (x: number, z: number) => {
      addBlock(x, GROUND_Y, z, "grass");
      for (let y = GROUND_Y - 1; y >= GROUND_Y - DIRT_DEPTH; y--) addBlock(x, y, z, "dirt");
      for (let y = GROUND_Y - DIRT_DEPTH - 1; y >= GROUND_Y - STONE_DEPTH; y--) addBlock(x, y, z, "stone");
    };

    const canGrowTreeAt = (x: number, z: number, height: number) => {
      if (!isWithinTerrain(x, z)) return false;
      if (x <= terrainStart + 1 || x >= terrainStart + TERRAIN_SIZE - 2 || z <= terrainStart + 1 || z >= terrainStart + TERRAIN_SIZE - 2) return false;
      if (blockRecords.get(blockKey(x, GROUND_Y, z))?.type !== "grass") return false;
      for (let y = GROUND_Y + 1; y <= GROUND_Y + height; y++) if (hasBlockAt(x, y, z)) return false;
      return true;
    };

    const growTree = (x: number, z: number, height: number) => {
      for (let y = GROUND_Y + 1; y <= GROUND_Y + height; y++) addBlock(x, y, z, "oakLog");
    };

    for (let z = 0; z < TERRAIN_SIZE; z++)
      for (let x = 0; x < TERRAIN_SIZE; x++)
        generateTerrainColumn(terrainStart + x, terrainStart + z);

    let treesPlaced = 0;
    for (let attempt = 0; attempt < TREE_ATTEMPTS; attempt++) {
      const x = terrainStart + 2 + Math.floor(Math.random() * (TERRAIN_SIZE - 4));
      const z = terrainStart + 2 + Math.floor(Math.random() * (TERRAIN_SIZE - 4));
      const height = TREE_MIN_HEIGHT + Math.floor(Math.random() * (TREE_MAX_HEIGHT - TREE_MIN_HEIGHT + 1));
      if (!canGrowTreeAt(x, z, height)) continue;
      growTree(x, z, height);
      if (++treesPlaced >= Math.max(8, Math.floor(TERRAIN_SIZE / 5))) break;
    }

    refreshActiveBlocks(true);

    const cameraState = { yaw: 0, pitch: 0 };
    const velocity = new THREE.Vector3();
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    const wishDirection = new THREE.Vector3();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const raycaster = new THREE.Raycaster();
    const centerPointer = new THREE.Vector2(0, 0);
    const playerBox = new THREE.Box3();
    const blockCoords = new THREE.Vector3();

    const keys: MovementKeys = { forward: false, backward: false, left: false, right: false };
    const runtime = { locked: false, grounded: true };
    const musicState = { audio: new Audio(), started: false, currentTrackIndex: -1 };

    // Create remote player model for multiplayer
    const createRemotePlayerModel = () => {
      const group = new THREE.Group();
      
      // Body
      const bodyGeo = new THREE.BoxGeometry(0.6, 0.8, 0.6);
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x44aa44 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.4;
      body.castShadow = true;
      group.add(body);
      
      // Head
      const headGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
      const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
      const head = new THREE.Mesh(headGeo, headMat);
      head.position.y = 0.85;
      head.castShadow = true;
      group.add(head);
      
      // Name tag
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 32;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.font = '12px "Courier New", monospace';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.fillText('Player', canvas.width/2, canvas.height/2 + 4);
      }
      const texture = new THREE.CanvasTexture(canvas);
      const nameTagMat = new THREE.SpriteMaterial({ map: texture });
      const nameTag = new THREE.Sprite(nameTagMat);
      nameTag.scale.set(0.8, 0.2, 1);
      nameTag.position.y = 1.2;
      group.add(nameTag);
      
      return group;
    };

    const setHotbarSelection = (index: number) => {
      const wrapped = ((index % HOTBAR_SLOTS.length) + HOTBAR_SLOTS.length) % HOTBAR_SLOTS.length;
      selectedHotbarIndexRef.current = wrapped;
      setSelectedHotbarIndex(wrapped);
      selectedBlockTypeRef.current = HOTBAR_SLOTS[wrapped];
      setSelectedBlockType(HOTBAR_SLOTS[wrapped]);
    };

    musicState.audio.crossOrigin = "anonymous";
    musicState.audio.preload = "auto";

    const inputState = {
      jumpHeld: false,
      destroyHeld: false,
      placeHeld: false,
      placeCooldown: 0,
    };
    const aimTarget = { current: null as AimTarget | null };
    const breakingState = { targetKey: null as string | null, elapsed: 0, stage: 0 };

    const resetInputState = () => {
      keys.forward = false; keys.backward = false; keys.left = false; keys.right = false;
      inputState.jumpHeld = false; inputState.destroyHeld = false; inputState.placeHeld = false;
      inputState.placeCooldown = 0;
      breakingState.targetKey = null; breakingState.elapsed = 0; breakingState.stage = 0;
      destroyOverlay.visible = false;
      shiftHeldRef.current = false; sprintKeyHeldRef.current = false;
      creativeBreakCooldownRef.current = 0;
    };

    const updateLockState = () => {
      runtime.locked = document.pointerLockElement === renderer.domElement;
      setIsLocked(runtime.locked);
      if (runtime.locked) renderer.domElement.focus();
      else resetInputState();
    };

    const requestLock = () => { renderer.domElement.focus(); renderer.domElement.requestPointerLock(); };

    const handleMouseMove = (e: MouseEvent) => {
      if (!runtime.locked) return;
      cameraState.yaw -= e.movementX * MOUSE_SENSITIVITY;
      cameraState.pitch -= e.movementY * MOUSE_SENSITIVITY;
      cameraState.pitch = THREE.MathUtils.clamp(cameraState.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    };

    const getNextMusicTrackIndex = (excludeIdx: number) => {
      if (MUSIC_TRACK_URLS.length === 0) return -1;
      if (MUSIC_TRACK_URLS.length === 1) return 0;
      let next = excludeIdx;
      while (next === excludeIdx) next = Math.floor(Math.random() * MUSIC_TRACK_URLS.length);
      return next;
    };

    const playRandomMusicTrack = () => {
      const next = getNextMusicTrackIndex(musicState.currentTrackIndex);
      if (next < 0) return;
      musicState.currentTrackIndex = next;
      musicState.audio.src = MUSIC_TRACK_URLS[next];
      musicState.audio.play().catch(() => (musicState.started = false));
    };

    const startBackgroundMusic = () => {
      if (musicState.started) return;
      musicState.started = true;
      musicState.audio.volume = 0.45;
      playRandomMusicTrack();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (chatOpenRef.current) return;
      if (event.repeat) return;
      switch (event.code) {
        case "KeyT": event.preventDefault(); openChat(""); break;
        case "Slash": event.preventDefault(); openChat("/"); break;
        case "F3": event.preventDefault(); setShowDebug(prev => !prev); break;
        case "KeyW": event.preventDefault(); keys.forward = true; break;
        case "KeyS": event.preventDefault(); keys.backward = true; break;
        case "KeyA": event.preventDefault(); keys.left = true; break;
        case "KeyD": event.preventDefault(); keys.right = true; break;
        case "Digit1": setHotbarSelection(0); break;
        case "Digit2": setHotbarSelection(1); break;
        case "Digit3": setHotbarSelection(2); break;
        case "Digit4": setHotbarSelection(3); break;
        case "Digit5": setHotbarSelection(4); break;
        case "Digit6": setHotbarSelection(5); break;
        case "Digit7": setHotbarSelection(6); break;
        case "Digit8": setHotbarSelection(7); break;
        case "Digit9": setHotbarSelection(8); break;
        case "Space":
          event.preventDefault();
          if (flightEnabledRef.current || gamemodeRef.current === "creative") {
            inputState.jumpHeld = true;
            if (spaceHoldTimerRef.current !== null) {
              clearTimeout(spaceHoldTimerRef.current);
              spaceHoldTimerRef.current = null;
            }
            jumpCountRef.current += 1;
            lastJumpTimeRef.current = performance.now();
            if (jumpCountRef.current >= 2) {
              flyingRef.current = !flyingRef.current;
              jumpCountRef.current = 0;
              velocity.set(0, 0, 0);
            } else {
              spaceHoldTimerRef.current = window.setTimeout(() => {
                jumpCountRef.current = 0;
                spaceHoldTimerRef.current = null;
              }, 200);
            }
          } else {
            inputState.jumpHeld = true;
          }
          break;
        case "ShiftLeft": case "ShiftRight": event.preventDefault(); shiftHeldRef.current = true; break;
        case "ControlLeft": case "ControlRight": event.preventDefault(); sprintKeyHeldRef.current = true; break;
        case "Escape": event.preventDefault(); if (runtime.locked) document.exitPointerLock(); break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      switch (event.code) {
        case "KeyW": event.preventDefault(); keys.forward = false; break;
        case "KeyS": event.preventDefault(); keys.backward = false; break;
        case "KeyA": event.preventDefault(); keys.left = false; break;
        case "KeyD": event.preventDefault(); keys.right = false; break;
        case "Space":
          event.preventDefault();
          inputState.jumpHeld = false;
          if (spaceHoldTimerRef.current) { clearTimeout(spaceHoldTimerRef.current); spaceHoldTimerRef.current = null; }
          break;
        case "ShiftLeft": case "ShiftRight": event.preventDefault(); shiftHeldRef.current = false; break;
        case "ControlLeft": case "ControlRight": event.preventDefault(); sprintKeyHeldRef.current = false; break;
      }
    };

    const getPlayerBox = () => {
      const h = playerHeightRef.current;
      playerBox.min.set(playerFeet.x - PLAYER_HALF_WIDTH, playerFeet.y, playerFeet.z - PLAYER_HALF_WIDTH);
      playerBox.max.set(playerFeet.x + PLAYER_HALF_WIDTH, playerFeet.y + h, playerFeet.z + PLAYER_HALF_WIDTH);
      return playerBox;
    };

    const blockIntersectsBox = (x: number, y: number, z: number, box: THREE.Box3) =>
      box.max.x > x && box.min.x < x + 1 && box.max.y > y && box.min.y < y + 1 && box.max.z > z && box.min.z < z + 1;

    const isSolidBlock = (x: number, y: number, z: number) => {
      const record = blockRecords.get(blockKey(x, y, z));
      return !!record && record.type !== "torch";
    };

    const hasFloorAt = (x: number, y: number, z: number) =>
      isSolidBlock(Math.floor(x), Math.floor(y - 0.001), Math.floor(z));

    const resolveAxisCollision = (axis: "x" | "y" | "z", delta: number) => {
      if (delta === 0) return false;
      playerFeet[axis] += delta;
      const box = getPlayerBox();
      const minX = Math.floor(box.min.x);
      const maxX = Math.floor(box.max.x - EPSILON);
      const minY = Math.floor(box.min.y);
      const maxY = Math.floor(box.max.y - EPSILON);
      const minZ = Math.floor(box.min.z);
      const maxZ = Math.floor(box.max.z - EPSILON);

      let collided = false;
      let correction = delta > 0 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

      for (let bx = minX; bx <= maxX; bx++) {
        for (let by = minY; by <= maxY; by++) {
          for (let bz = minZ; bz <= maxZ; bz++) {
            if (!isSolidBlock(bx, by, bz) || !blockIntersectsBox(bx, by, bz, box)) continue;
            collided = true;

            if (axis === "x") {
              const cand = delta > 0 ? bx - box.max.x : bx + 1 - box.min.x;
              if (delta > 0 && cand < 0) correction = Math.max(correction, cand);
              else if (delta < 0 && cand > 0) correction = Math.min(correction, cand);
            } else if (axis === "y") {
              const cand = delta > 0 ? by - box.max.y : by + 1 - box.min.y;
              if (delta > 0 && cand < 0) correction = Math.max(correction, cand);
              else if (delta < 0 && cand > 0) correction = Math.min(correction, cand);
            } else if (axis === "z") {
              const cand = delta > 0 ? bz - box.max.z : bz + 1 - box.min.z;
              if (delta > 0 && cand < 0) correction = Math.max(correction, cand);
              else if (delta < 0 && cand > 0) correction = Math.min(correction, cand);
            }
          }
        }
      }

      if (collided && Number.isFinite(correction)) {
        playerFeet[axis] += correction;
      }
      return collided;
    };

    const getTargetIntersection = () => {
      raycaster.setFromCamera(centerPointer, camera);
      return raycaster.intersectObjects(Array.from(instancedMeshes.values()), false)[0];
    };

    const updateAimTarget = () => {
      if (gamemodeRef.current === "adventure" || gamemodeRef.current === "spectator" || spectatorActiveRef.current) {
        aimTarget.current = null;
        selectionOutline.visible = false;
        return;
      }
      const hit = runtime.locked ? getTargetIntersection() : undefined;
      if (!hit?.object || !hit.face) { aimTarget.current = null; selectionOutline.visible = false; return; }
      const type = (hit.object.userData as { blockType?: BlockType }).blockType;
      const instanceId = hit.instanceId;
      if (!type || instanceId === undefined) { aimTarget.current = null; selectionOutline.visible = false; return; }
      const lookup = instancedLookup.get(type);
      const record = lookup?.[instanceId];
      if (!record) { aimTarget.current = null; selectionOutline.visible = false; return; }
      const faceNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      aimTarget.current = {
        type: record.type,
        x: record.x, y: record.y, z: record.z,
        normal: new THREE.Vector3(Math.round(faceNormal.x), Math.round(faceNormal.y), Math.round(faceNormal.z)),
      };
      selectionOutline.geometry = record.type === "torch" ? torchSelectionGeometry : selectionGeometry;
      selectionOutline.position.set(record.x + 0.5, record.y + (record.type === "torch" ? TORCH_CENTER_Y : 0.5), record.z + 0.5);
      selectionOutline.visible = true;
    };

    const resetBreakingState = () => {
      breakingState.targetKey = null;
      breakingState.elapsed = 0;
      breakingState.stage = 0;
      destroyOverlay.visible = false;
    };

    const destroyTargetBlock = () => {
      if (!aimTarget.current || gamemodeRef.current === "adventure" || gamemodeRef.current === "spectator") return false;
      const removed = removeBlock(aimTarget.current.x, aimTarget.current.y, aimTarget.current.z);
      if (removed) {
        removeUnsupportedTorches(aimTarget.current.x, aimTarget.current.y, aimTarget.current.z);
        refreshActiveBlocks(true);
        resetBreakingState();
      }
      return removed;
    };

    const placeTargetBlock = () => {
      if (!aimTarget.current || gamemodeRef.current === "adventure" || gamemodeRef.current === "spectator") return false;
      if (!selectedBlockTypeRef.current) return false;
      blockCoords.set(
        aimTarget.current.x + aimTarget.current.normal.x,
        aimTarget.current.y + aimTarget.current.normal.y,
        aimTarget.current.z + aimTarget.current.normal.z
      );
      if (isSolidBlock(blockCoords.x, blockCoords.y, blockCoords.z)) return false;
      const targetBox = new THREE.Box3(
        new THREE.Vector3(blockCoords.x, blockCoords.y, blockCoords.z),
        new THREE.Vector3(blockCoords.x + 1, blockCoords.y + 1, blockCoords.z + 1)
      );
      if (targetBox.intersectsBox(getPlayerBox())) return false;
      const placed = addBlock(blockCoords.x, blockCoords.y, blockCoords.z, selectedBlockTypeRef.current);
      if (placed) refreshActiveBlocks(true);
      return placed;
    };

    const handleMouseUp = (event: MouseEvent) => {
      if (event.button === 0) { inputState.destroyHeld = false; resetBreakingState(); }
      if (event.button === 2) { inputState.placeHeld = false; }
    };

    const handleMouseDown = (event: MouseEvent) => {
      event.preventDefault();
      startBackgroundMusic();
      if (!runtime.locked) { requestLock(); return; }
      if (event.button === 0) {
        if (gamemodeRef.current === "adventure" || gamemodeRef.current === "spectator") return;
        inputState.destroyHeld = true;
        resetBreakingState();
      }
      if (event.button === 2) {
        if (gamemodeRef.current === "adventure" || gamemodeRef.current === "spectator") return;
        inputState.placeHeld = true;
        placeTargetBlock();
      }
    };

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      setHotbarSelection(selectedHotbarIndexRef.current + (e.deltaY > 0 ? 1 : -1));
    };

    const handleResize = () => {
      const w = mount.clientWidth, h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const handleWindowBlur = () => resetInputState();

    // ========== MULTIPLAYER SETUP ==========
    const playerRef = ref(database, `players/${localPlayerId.current}`);
    const playerName = `Player_${Math.floor(Math.random() * 1000)}`;
    
    const updatePosition = () => {
      set(playerRef, {
        name: playerName,
        x: playerFeet.x,
        y: playerFeet.y,
        z: playerFeet.z,
        yaw: cameraState.yaw,
        pitch: cameraState.pitch,
        lastSeen: Date.now(),
      }).catch(console.error);
    };
    
    const positionInterval = setInterval(updatePosition, 50);
    onDisconnect(playerRef).remove();
    
    const playersListener = onValue(playersRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      
      const currentRemoteIds = new Set<string>();
      let onlineCount = 0;
      
      for (const [id, playerData] of Object.entries(data)) {
        if (id === localPlayerId.current) continue;
        currentRemoteIds.add(id);
        onlineCount++;
        
        if (!remotePlayers.current.has(id)) {
          const model = createRemotePlayerModel();
          scene.add(model);
          remotePlayers.current.set(id, model);
        }
        
        const model = remotePlayers.current.get(id)!;
        const dataAny = playerData as any;
        model.position.set(dataAny.x, dataAny.y, dataAny.z);
        model.rotation.y = dataAny.yaw || 0;
        
        // Update name tag
        if (model.children[3] && model.children[3] instanceof THREE.Sprite) {
          const canvas = document.createElement('canvas');
          canvas.width = 128;
          canvas.height = 32;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = '12px "Courier New", monospace';
            ctx.fillStyle = 'white';
            ctx.textAlign = 'center';
            ctx.fillText(dataAny.name || 'Player', canvas.width/2, canvas.height/2 + 4);
          }
          (model.children[3] as THREE.Sprite).material.map?.dispose();
          (model.children[3] as THREE.Sprite).material.map = new THREE.CanvasTexture(canvas);
        }
      }
      
      setPlayerCount(onlineCount + 1);
      
      for (const [id, model] of remotePlayers.current.entries()) {
        if (!currentRemoteIds.has(id)) {
          scene.remove(model);
          remotePlayers.current.delete(id);
        }
      }
    });
    // ========== END MULTIPLAYER ==========

    renderer.domElement.addEventListener("mousedown", handleMouseDown);
    renderer.domElement.addEventListener("contextmenu", handleContextMenu);
    renderer.domElement.addEventListener("wheel", handleWheel, { passive: false });
    document.addEventListener("pointerlockchange", updateLockState);
    document.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    window.addEventListener("resize", handleResize);
    window.addEventListener("blur", handleWindowBlur);
    musicState.audio.addEventListener("ended", playRandomMusicTrack);

    handleResize();

    let frameId = 0;
    let worldStreamUpdateTimer = 0;
    let lastStreamCellX = NaN, lastStreamCellZ = NaN;
    let lastTime = performance.now();

    const moveTowards = (cur: number, target: number, max: number) =>
      cur < target ? Math.min(cur + max, target) : Math.max(cur - max, target);

    const animate = () => {
      frameId = requestAnimationFrame(animate);
      const now = performance.now();
      const delta = Math.min((now - lastTime) / 1000, 0.033);
      lastTime = now;

      creativeBreakCooldownRef.current = Math.max(0, creativeBreakCooldownRef.current - delta);

      const crouching = !flyingRef.current && shiftHeldRef.current && !spectatorActiveRef.current;
      playerHeightRef.current = crouching ? PLAYER_CROUCH_HEIGHT : PLAYER_HEIGHT;
      const sprinting = sprintKeyHeldRef.current && keys.forward && !keys.backward && !crouching && !flyingRef.current && !spectatorActiveRef.current;

      const targetEyeHeight = crouching ? CROUCH_EYE_HEIGHT : PLAYER_EYE_HEIGHT;
      const targetFov = sprinting ? 90 : 70;
      const smooth = Math.min(10 * delta, 1);
      currentEyeHeightRef.current += (targetEyeHeight - currentEyeHeightRef.current) * smooth;
      currentFovRef.current += (targetFov - currentFovRef.current) * smooth;
      camera.fov = currentFovRef.current;
      camera.updateProjectionMatrix();
      camera.position.set(playerFeet.x, playerFeet.y + currentEyeHeightRef.current, playerFeet.z);
      camera.rotation.order = "YXZ";
      camera.rotation.y = cameraState.yaw;
      camera.rotation.x = cameraState.pitch;

      handModel.position.set(handPos.x, handPos.y, handPos.z);
      handModel.rotation.set(
        THREE.MathUtils.degToRad(handRot.x),
        THREE.MathUtils.degToRad(handRot.y),
        THREE.MathUtils.degToRad(handRot.z)
      );
      handModel.visible = !spectatorActiveRef.current;

      worldStreamUpdateTimer -= delta;
      const streamX = Math.floor(playerFeet.x), streamZ = Math.floor(playerFeet.z);
      if (worldStreamUpdateTimer <= 0 || streamX !== lastStreamCellX || streamZ !== lastStreamCellZ) {
        refreshActiveBlocks();
        worldStreamUpdateTimer = WORLD_STREAM_UPDATE_INTERVAL;
        lastStreamCellX = streamX; lastStreamCellZ = streamZ;
      }

      updateAimTarget();

      let moveSpeed = MOVE_SPEED;
      if (crouching) moveSpeed = SNEAK_SPEED;
      else if (sprinting) moveSpeed = SPRINT_SPEED;

      if (spectatorActiveRef.current) {
        camera.getWorldDirection(forward);
        right.crossVectors(forward, worldUp).normalize();
        velocity.set(0, 0, 0);
        if (keys.forward) velocity.addScaledVector(forward, moveSpeed);
        if (keys.backward) velocity.addScaledVector(forward, -moveSpeed);
        if (keys.left) velocity.addScaledVector(right, -moveSpeed);
        if (keys.right) velocity.addScaledVector(right, moveSpeed);
        if (inputState.jumpHeld) velocity.y += moveSpeed;
        if (shiftHeldRef.current) velocity.y -= moveSpeed;
        playerFeet.add(velocity.clone().multiplyScalar(delta));
      } else if (flyingRef.current) {
        camera.getWorldDirection(forward);
        const horiz = forward.clone(); horiz.y = 0;
        horiz.normalize();
        if (horiz.lengthSq() === 0) horiz.set(0, 0, -1);
        right.crossVectors(horiz, worldUp).normalize();
        velocity.set(0, 0, 0);
        if (keys.forward) velocity.addScaledVector(horiz, moveSpeed);
        if (keys.backward) velocity.addScaledVector(horiz, -moveSpeed);
        if (keys.left) velocity.addScaledVector(right, -moveSpeed);
        if (keys.right) velocity.addScaledVector(right, moveSpeed);
        if (inputState.jumpHeld) velocity.y += moveSpeed;
        if (shiftHeldRef.current) velocity.y -= moveSpeed;
        resolveAxisCollision("x", velocity.x * delta);
        resolveAxisCollision("z", velocity.z * delta);
        resolveAxisCollision("y", velocity.y * delta);
      } else {
        camera.getWorldDirection(forward); forward.y = 0;
        if (forward.lengthSq() > 0) forward.normalize();
        else forward.set(0, 0, -1);
        right.crossVectors(forward, worldUp).normalize();
        const inputFwd = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
        const inputR = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
        wishDirection.set(0, 0, 0);
        if (inputFwd !== 0 || inputR !== 0) wishDirection.addScaledVector(forward, inputFwd).addScaledVector(right, inputR).normalize();

        if (wishDirection.lengthSq() > 0) {
          velocity.x = wishDirection.x * moveSpeed;
          velocity.z = wishDirection.z * moveSpeed;
        } else {
          velocity.x = moveTowards(velocity.x, 0, STOP_DECEL * delta);
          velocity.z = moveTowards(velocity.z, 0, STOP_DECEL * delta);
        }

        velocity.y -= GRAVITY * delta;
        velocity.y = Math.max(velocity.y, TERMINAL_VELOCITY);
        if (runtime.grounded && inputState.jumpHeld && !crouching) velocity.y = JUMP_SPEED;

        const prevX = playerFeet.x, prevZ = playerFeet.z;
        runtime.grounded = false;
        if (resolveAxisCollision("x", velocity.x * delta)) velocity.x = 0;
        if (resolveAxisCollision("z", velocity.z * delta)) velocity.z = 0;

        if (crouching && hasFloorAt(playerFeet.x, playerFeet.y, playerFeet.z) && !hasFloorAt(playerFeet.x, playerFeet.y, playerFeet.z)) {
          playerFeet.x = prevX;
          playerFeet.z = prevZ;
          velocity.x = 0; velocity.z = 0;
        }

        if (resolveAxisCollision("y", velocity.y * delta)) {
          if (velocity.y < 0) runtime.grounded = true;
          velocity.y = 0;
        }
      }

      if (inputState.destroyHeld && !spectatorActiveRef.current) {
        if (gamemodeRef.current === "creative" && creativeBreakCooldownRef.current > 0) {
        } else if (!aimTarget.current) {
          resetBreakingState();
        } else {
          const key = blockKey(aimTarget.current.x, aimTarget.current.y, aimTarget.current.z);
          if (breakingState.targetKey !== key) {
            breakingState.targetKey = key;
            breakingState.elapsed = 0;
            breakingState.stage = 0;
          } else {
            breakingState.elapsed += delta;
          }
          const breakDuration = getBlockBreakDuration(aimTarget.current.type);
          if (breakDuration === 0) {
            destroyTargetBlock();
            creativeBreakCooldownRef.current = CREATIVE_BREAK_COOLDOWN;
          } else {
            const interval = breakDuration / BLOCK_BREAK_STAGE_COUNT;
            if (breakingState.elapsed >= breakDuration) {
              destroyTargetBlock();
            } else {
              const nextStage = Math.min(Math.floor(breakingState.elapsed / interval), BLOCK_BREAK_STAGE_COUNT - 1);
              breakingState.stage = nextStage;
              destroyOverlay.material = destroyStageMaterials[nextStage];
              destroyOverlay.geometry = aimTarget.current.type === "torch" ? torchDestroyOverlayGeometry : destroyOverlayGeometry;
              destroyOverlay.position.set(
                aimTarget.current.x + 0.5,
                aimTarget.current.y + (aimTarget.current.type === "torch" ? TORCH_CENTER_Y : 0.5),
                aimTarget.current.z + 0.5
              );
              destroyOverlay.visible = true;
            }
          }
        }
      } else {
        destroyOverlay.visible = false;
      }

      if (inputState.placeHeld && !spectatorActiveRef.current) {
        inputState.placeCooldown -= delta;
        if (inputState.placeCooldown <= 0) {
          placeTargetBlock();
          inputState.placeCooldown = PLACE_REPEAT_INTERVAL;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      clearInterval(positionInterval);
      playersListener();
      camera.remove(handModel);
      renderer.domElement.removeEventListener("mousedown", handleMouseDown);
      renderer.domElement.removeEventListener("contextmenu", handleContextMenu);
      renderer.domElement.removeEventListener("wheel", handleWheel);
      document.removeEventListener("pointerlockchange", updateLockState);
      document.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("blur", handleWindowBlur);
      musicState.audio.removeEventListener("ended", playRandomMusicTrack);
      musicState.audio.pause(); musicState.audio.src = "";
      renderer.dispose();
      blockGeometry.dispose(); torchGeometry.dispose();
      selectionGeometry.dispose(); torchSelectionGeometry.dispose();
      destroyOverlayGeometry.dispose(); torchDestroyOverlayGeometry.dispose();
      selectionMaterial.dispose();
      destroyStageMaterials.forEach(m => m[0]?.dispose());
      dirtMaterial.dispose(); grassTopMaterial.dispose(); grassSideMaterial.dispose();
      stoneMaterial.dispose(); oakLogSideMaterial.dispose(); oakLogTopMaterial.dispose();
      torchMaterial.dispose();
      textures.dirt.dispose(); textures.grassTop.dispose(); textures.grassSide.dispose();
      textures.stone.dispose(); textures.oakLogSide.dispose(); textures.oakLogTop.dispose();
      textures.torch.dispose();
      textures.destroyStages.forEach(t => t.dispose());
      mount.removeChild(renderer.domElement);
    };
  }, [handPos, handRot]);

  const getCommandSuggestions = (): string[] => {
    if (!chatInput.startsWith("/")) return [];
    const lower = chatInput.toLowerCase();
    if (lower === "/" || "/gamemode".startsWith(lower.split(" ")[0])) {
      if (lower === "/" || "/gamemode".startsWith(lower)) return ["/gamemode"];
      if (lower.startsWith("/gamemode ")) return ["c", "creative", "s", "survival", "spectator", "adventure"];
    }
    return [];
  };

  const visibleChatMessages = chatOpen
    ? chatInput.startsWith("/") ? [] : chatMessages
    : chatMessages.filter(msg => Date.now() - msg.createdAt < CHAT_FADE_MS || msg.tutorial);

  return (
    <div ref={mountRef} className="relative h-screen w-screen overflow-hidden bg-sky-300 text-white"
      style={{ cursor: isLocked ? "none" : "default" }}>
      
      {/* Player Count Display */}
      <div className="absolute top-4 right-4 z-50 bg-black/60 px-3 py-1 rounded-lg text-white text-sm font-mono pointer-events-none">
        👥 Players Online: {playerCount}
      </div>
      
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="relative h-4 w-4 opacity-90">
          <span className="absolute left-1/2 top-1/2 h-px w-4 -translate-x-1/2 -translate-y-1/2 bg-white/90" />
          <span className="absolute left-1/2 top-1/2 h-4 w-px -translate-x-1/2 -translate-y-1/2 bg-white/90" />
        </div>
      </div>

      {showDebug && (
        <div className="absolute top-4 right-4 z-50 bg-black/80 p-4 rounded-lg text-white text-sm pointer-events-auto" style={{ fontFamily: "monospace", minWidth: "300px" }}>
          <div className="font-bold text-lg mb-3">Hand Model Debug</div>
          
          <div className="mb-4">
            <div className="font-semibold mb-2">Position</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-4">X:</span>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={handPos.x}
                onChange={(e) => setHandPos(prev => ({ ...prev, x: parseFloat(e.target.value) }))}
                className="flex-1"
              />
              <input
                type="number"
                value={handPos.x}
                onChange={(e) => setHandPos(prev => ({ ...prev, x: parseFloat(e.target.value) || 0 }))}
                className="w-16 bg-gray-700 text-white px-1 py-0.5 rounded text-xs"
                step="0.1"
              />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-4">Y:</span>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={handPos.y}
                onChange={(e) => setHandPos(prev => ({ ...prev, y: parseFloat(e.target.value) }))}
                className="flex-1"
              />
              <input
                type="number"
                value={handPos.y}
                onChange={(e) => setHandPos(prev => ({ ...prev, y: parseFloat(e.target.value) || 0 }))}
                className="w-16 bg-gray-700 text-white px-1 py-0.5 rounded text-xs"
                step="0.1"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4">Z:</span>
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={handPos.z}
                onChange={(e) => setHandPos(prev => ({ ...prev, z: parseFloat(e.target.value) }))}
                className="flex-1"
              />
              <input
                type="number"
                value={handPos.z}
                onChange={(e) => setHandPos(prev => ({ ...prev, z: parseFloat(e.target.value) || 0 }))}
                className="w-16 bg-gray-700 text-white px-1 py-0.5 rounded text-xs"
                step="0.1"
              />
            </div>
          </div>

          <div className="mb-4">
            <div className="font-semibold mb-2">Rotation (degrees)</div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-4">X:</span>
              <input
                type="range"
                min="-180"
                max="180"
                step="0.1"
                value={handRot.x}
                onChange={(e) => setHandRot(prev => ({ ...prev, x: parseFloat(e.target.value) }))}
                className="flex-1"
              />
              <input
                type="number"
                value={handRot.x}
                onChange={(e) => setHandRot(prev => ({ ...prev, x: parseFloat(e.target.value) || 0 }))}
                className="w-16 bg-gray-700 text-white px-1 py-0.5 rounded text-xs"
                step="0.1"
              />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-4">Y:</span>
              <input
                type="range"
                min="-180"
                max="180"
                step="0.1"
                value={handRot.y}
                onChange={(e) => setHandRot(prev => ({ ...prev, y: parseFloat(e.target.value) }))}
                className="flex-1"
              />
              <input
                type="number"
                value={handRot.y}
                onChange={(e) => setHandRot(prev => ({ ...prev, y: parseFloat(e.target.value) || 0 }))}
                className="w-16 bg-gray-700 text-white px-1 py-0.5 rounded text-xs"
                step="0.1"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4">Z:</span>
              <input
                type="range"
                min="-180"
                max="180"
                step="0.1"
                value={handRot.z}
                onChange={(e) => setHandRot(prev => ({ ...prev, z: parseFloat(e.target.value) }))}
                className="flex-1"
              />
              <input
                type="number"
                value={handRot.z}
                onChange={(e) => setHandRot(prev => ({ ...prev, z: parseFloat(e.target.value) || 0 }))}
                className="w-16 bg-gray-700 text-white px-1 py-0.5 rounded text-xs"
                step="0.1"
              />
            </div>
          </div>

          <button
            onClick={copyHandConfig}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded transition-colors"
          >
            Copy Position & Rotation
          </button>
          
          <div className="mt-3 text-xs text-gray-400">
            Press F3 to toggle this panel
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-0">
        {HOTBAR_SLOTS.map((slot, index) => {
          const isSelected = index === selectedHotbarIndex;
          return (
            <div key={index} className="relative h-14 w-14 bg-[length:100%_100%] bg-center bg-no-repeat"
              style={{
                backgroundImage: `url(${isSelected ? UI_TEXTURE_URLS.hotbarSelected : UI_TEXTURE_URLS.hotbarSlot})`,
                imageRendering: "pixelated",
              }}>
              {index === 0 && !isSelected && (
                <span className="absolute bottom-0 top-0 bg-[length:100%_100%] bg-left bg-no-repeat"
                  style={{ backgroundImage: `url(${UI_TEXTURE_URLS.hotbarEndCap})`, imageRendering: "pixelated", width: "3px", left: "-3px" }} />
              )}
              {index === HOTBAR_SLOTS.length - 1 && !isSelected && (
                <span className="absolute bottom-0 top-0 scale-x-[-1] bg-[length:100%_100%] bg-left bg-no-repeat"
                  style={{ backgroundImage: `url(${UI_TEXTURE_URLS.hotbarEndCap})`, imageRendering: "pixelated", width: "2px", right: "-2px" }} />
              )}
              <span className="absolute right-1 top-0.5 text-[10px] font-bold text-white/90" style={{ textShadow: "0 1px 1px rgba(0,0,0,0.8)" }}>
                {index + 1}
              </span>
              {slot && (
                <span className="absolute inset-x-0 bottom-1 text-center text-[9px] uppercase tracking-[0.18em] text-white/85"
                  style={{ textShadow: "0 1px 1px rgba(0,0,0,0.85)" }}>
                  {slot === "oakLog" ? "Oak Log" : slot === "torch" ? "Torch" : slot}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute left-3 bottom-4 z-20 w-[min(38rem,calc(100%-1.5rem))]" style={{ fontFamily: "Minecraft, monospace" }}>
        {chatInput.startsWith("/") ? (
          <div className="pointer-events-none flex flex-col gap-1 mb-2">
            {getCommandSuggestions().map((s, i) => (
              <div key={i} className="w-fit max-w-full bg-black/45 px-2 py-1 text-[18px] leading-none text-white"
                style={{ textShadow: "2px 2px 0 rgba(0,0,0,0.75)" }}>{s}</div>
            ))}
          </div>
        ) : (
          <div className="pointer-events-none flex flex-col gap-1">
            {visibleChatMessages.map(msg => {
              const age = Date.now() - msg.createdAt;
              const opacity = chatOpen ? 1 : Math.max(0, 1 - Math.max(0, age - 4000) / 1000);
              return (
                <div key={msg.id} className="w-fit max-w-full bg-black/45 px-2 py-1 text-[18px] leading-none text-white"
                  style={{ opacity, textShadow: "2px 2px 0 rgba(0,0,0,0.75)" }}>{msg.text}</div>
              );
            })}
          </div>
        )}

        {chatOpen && (
          <form className="mt-2" onSubmit={e => {
            e.preventDefault();
            const value = chatInput.trimEnd();
            if (value.trim().length > 0) {
              addChatMessageRef.current(value);
              if (value.trimStart().startsWith("/")) runChatCommandRef.current(value);
            }
            closeChatRef.current();
          }}>
            <div className="flex h-11 items-center bg-[rgba(0,0,0,0.55)] px-2">
              <input ref={chatInputRef} value={chatInput} onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeChatRef.current(); } }}
                className="w-full border-0 bg-transparent text-[20px] leading-none text-white outline-none"
                style={{ fontFamily: "Minecraft, monospace", textShadow: "2px 2px 0 rgba(0,0,0,0.75)" }}
                spellCheck={false} autoComplete="off" />
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
