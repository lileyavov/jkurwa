var Big = require('./big.js'),
    sjcl = require('./libs/sjcl/sjcl.js'),
    ZERO = new Big("0"),
    ONE = new Big("1");

sjcl.random.startCollectors();

var fmul = function(value_1, value_2, modulus) {
    var ret = ZERO, j, bitl_a;
    bitl_1 = value_1.bitLength();
    for(j = 0; j < bitl_1; j++ ) {
        if(value_1.testBit(j)) {
            ret = ret.xor(value_2);
        }
        value_2 = value_2.shiftLeft(1);
    }
    return fmod(ret, modulus);

},
fmod = function(val, modulus) {
    var rv, bitm_l, mask;
    if(val.compareTo(modulus) < 0) {
        return val;
    }
    rv = val;
    bitm_l = modulus.bitLength();
    while(rv.bitLength() >= bitm_l) {
        mask = modulus.shiftLeft(rv.bitLength() - bitm_l);
        rv = rv.xor(mask);
    }

    return rv;
},
finv = function(value, modulus) {
    var b, c, u, v;

    b = ONE;
    c = ZERO;
    u = fmod(value, modulus);
    v = modulus;

    while(u.bitLength() > 1) {
        j = u.bitLength() - v.bitLength();
        if(j < 0) {
            var tmp;
            tmp = u;
            u = v;
            v = tmp;

            tmp = c;
            c = b;
            b = tmp;

            j = -j;
        }

        u = u.xor(v.shiftLeft(j))
        b = b.xor(c.shiftLeft(j))
    }

    return b;
};

var Field = function(param_modulus, value, is_mod) {
    var modulus = param_modulus, value;
    mod = function(val) {
        return fmod(val, modulus);
    },
    mul = function(val) {
        return fmul(val, ob.value, modulus);
    },
    add = function(val) {
        return ob.value.xor(val);
    },
    inv = function() {
        return finv(ob.value, modulus);
    };
    var ob = {
        "mul": mul,
        "mod": mod,
        "add": add,
        "inv": inv,
        "value": value,
    }
    if(is_mod !== true)
        ob.value = mod(value);
    return ob;
}

var Point = function(p_curve, p_x, p_y) {
    var field_x = Field(p_curve.modulus, p_x),
        field_y = Field(p_curve.modulus, p_y),
        zero = ZERO,
        modulus = p_curve.modulus;

    var add = function(point_1) {
        var a, x0, x1, y0, y1, x2, y2, point_2, lbd, tmp, tmp2;

        a = p_curve.param_a;
        point_2 = new Point(p_curve, zero, zero);

        x0 = field_x.value;
        y0 = field_y.value;
        x1 = point_1.x.value;
        y1 = point_1.y.value;

        if(is_zero()) {
            return point_1;
        }

        if(point_1.is_zero()) {
            return ob;
        }

        if(x0.compareTo(x1) != 0) {
            tmp = y0.xor(y1);
            tmp2 = x0.xor(x1);
            lbd = fmul(tmp, finv(tmp2, p_curve.modulus),  p_curve.modulus);
            x2 = a.xor(fmul(lbd, lbd, p_curve.modulus));
            x2 = x2.xor(lbd)
            x2 = x2.xor(x0)
            x2 = x2.xor(x1)
        } else {
            if(y1.compareTo(y0) != 0) {
                return point_2;
            } else {
                if(x1.compareTo(zero) == 0) {
                    return point_2;
                } else {
                    lbd = x1.xor(
                            point_1.y.mul(point_1.x.inv())
                    )
                    x2 = fmul(lbd, lbd, p_curve.modulus).xor(a);
                    x2 = x2.xor(lbd);
                }
            }
        }
        y2 = fmul(lbd, x1.xor(x2), p_curve.modulus);
        y2 = y2.xor(x2);
        y2 = y2.xor(y1)

        point_2.x.value = x2
        point_2.y.value = y2

        return point_2;

    },
    mul = function(param_n) {
        var point_s = new Point(p_curve, zero, zero), cmp, point;
        cmp = param_n.compareTo(zero)
        if(cmp == 0) {
            return point_s;
        }

        if(cmp < 0) {
            param_n = param_n.negate();
            point = negate();
        } else {
            point = this;
        }

        var bitn_l = param_n.bitLength();
        for(var j = bitn_l-1; j >= 0; j--) {
            point_s = point_s.add(point_s);
            if(param_n.testBit(j)) {
                point_s = point_s.add(point);
            }
        }

        return point_s;
    },
    negate = function() {
        return new Point(p_curve, field_x.value, field_x.value.xor(field_y.value));
    },
    is_zero = function() {
        return (field_x.value.compareTo(zero) == 0) && (field_y.value.compareTo(zero) == 0)
    },
    toString = function() {
        return "<Point x:"+field_x.value.toString(16)+", y:" + field_y.value.toString(16) + " >"
    };

    var ob = {
        "add": add,
        "mul": mul,
        "is_zero": is_zero,
        "negate": negate,
        "toString": toString,
        "x": field_x,
        "y": field_y,
    };
    return ob;
}

var Pub = function(p_curve, point_q) {
    var zero = ZERO,
    help_verify = function(hash_val, s, r) {
        if(zero.compareTo(s) == 0) {
            throw new Error("Invalid sig component S");
        }
        if(zero.compareTo(r) == 0) {
            throw new Error("Invalid sig component R");
        }

        if(p_curve.order.compareTo(s) < 0) {
            throw new Error("Invalid sig component S");
        }
        if(p_curve.order.compareTo(r) < 0) {
            throw new Error("Invalid sig component R");
        }

        var mulQ, mulS, pointR, r1;

        mulQ = point_q.mul(r);
        mulS = p_curve.base.mul(s);

        pointR = mulS.add(mulQ);
        if(pointR.is_zero()) {
            throw new Error("Invalid sig R point at infinity");
        }

        r1 = pointR.x.mul(hash_val);
        r1 = p_curve.truncate(r1);

        return r.compareTo(r1) == 0;
    };
    var ob = {
        x: point_q.x,
        y: point_q.y,
        point: point_q,
        _help_verify: help_verify
    };
    return ob;
};

var Priv = function(p_curve, param_d) {
    var field_d = new Field(p_curve.modulus, param_d, true);

    var help_sign = function(hash_v, rand_e) {
        var eG, r, s, hash_field;

        hash_field = new Field(p_curve.modulus, hash_v, true);
        eg = p_curve.base.mul(rand_e);
        r = hash_field.mul(eg.x.value);
        r = p_curve.truncate(r);

        s = param_d.multiply(r).mod(p_curve.order);
        s = s.add(rand_e).mod(p_curve.order);

        return {
            "s": s,
            "r": r,
        }
    },
    sign = function(hash_v) {
        var bits, words, rand, rand_e, rand_word, sign;

        while(!sjcl.random.isReady()) {
            true;
        }
        bits = p_curve.order.bitLength();
        words = Math.floor((bits+31) / 32);
        rand = sjcl.random.randomWords(words);
        rand_e = ZERO;
        sign = new Big('100000000', 16);

        for(var i=0; i< words; i++) {
            rand_word = new Big(null);
            rand_word.fromInt(rand[i]);
            if(rand[i]<0) {
                rand_word = rand_word.add(sign);
            }
            rand_e = rand_e.shiftLeft(32).or(rand_word);
        }

        return help_sign(hash_v, rand_e);

    },
    pub = function() {
        return new Pub(p_curve, p_curve.base.mul(param_d).negate());
    };
    var ob = {
        '_help_sign': help_sign,
        'sign': sign,
        'pub': pub,
    };
    return ob;
}

var Curve = function() {
    var modulus = ZERO,
        zero = ZERO,
    comp_modulus = function(k3, k2, k1) {
        var modulus = ZERO,
        modulus = modulus.setBit(k1);
        modulus = modulus.setBit(k2);
        modulus = modulus.setBit(k3);
        ob.modulus = modulus;
    },
    set_base = function(base_x, base_y) {
        ob.base = point(base_x, base_y);
    },
    field = function(val) {
        return new Field(ob.modulus, val);
    },
    point = function(px, py) {
        return new Point(ob, px, py);
    },
    truncate = function(value) {
        var bitl_o = ob.order.bitLength(),
            xbit = value.bitLength();

        while(bitl_o <= xbit) {
            value = value.clearBit(xbit - 1);
            xbit = value.bitLength();
        }
        return value;
    },
    contains = function(point) {
        var lh, y2;
        lh = point.x.value.xor(ob.param_a);
        lh = fmul(lh, point.x.value, ob.modulus);
        lh = lh.xor(point.y.value);
        lh = fmul(lh, point.x.value, ob.modulus);
        lh = lh.xor(ob.param_b);
        y2 = fmul(point.y.value, point.y.value, ob.modulus);
        lh = lh.xor(y2);

        return lh.compareTo(ZERO) == 0;
    };

    var ob = {
        "field": field,
        "point": point,
        "comp_modulus": comp_modulus,
        "set_base": set_base,
        "modulus": modulus,
        "truncate": truncate,
        "contains": contains,
    };
    return ob;
}

module.exports = Curve
module.exports.Field = Field
module.exports.Priv = Priv