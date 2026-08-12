import { Field, verify, ZkProgram } from "o1js";

const MesaBoundSquare = ZkProgram({
  name: "mina-safe-mesa-bound-square-v1",
  publicInput: Field,
  methods: {
    proveSquare: {
      privateInputs: [Field],
      async method(expectedSquare, root) {
        root.mul(root).assertEquals(expectedSquare);
      },
    },
  },
});

const { verificationKey } = await MesaBoundSquare.compile();
const { proof } = await MesaBoundSquare.proveSquare(Field(25), Field(5));
if (!(await verify(proof.toJSON(), verificationKey))) {
  throw new Error("Mesa compatibility proof did not verify.");
}

process.stdout.write("Mesa compatibility proof verified with o1js 3.0.0-mesa.rc2.\n");
