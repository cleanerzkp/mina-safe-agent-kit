import { Field, ZkProgram } from "o1js";

export const PROGRAM_NAME = "mina-safe-bound-square-v1";

export const BoundSquare = ZkProgram({
  name: PROGRAM_NAME,
  publicInput: Field,
  publicOutput: Field,
  methods: {
    proveSquare: {
      privateInputs: [Field],
      async method(expectedSquare: Field, root: Field) {
        root.mul(root).assertEquals(expectedSquare);
        return { publicOutput: root };
      },
    },
  },
});
